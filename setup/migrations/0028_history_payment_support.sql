-- Миграция 0028: Поддержка платежей в history авто-процессоре
-- Дата: 2025-11-14

-- =====================================================
-- 1. Подготовка
-- =====================================================

DROP TRIGGER IF EXISTS auto_process_history_trigger ON history;

-- =====================================================
-- 2. Улучшенный парсер description
-- =====================================================

DROP FUNCTION IF EXISTS parse_history_description(TEXT);

CREATE OR REPLACE FUNCTION parse_history_description(description_text TEXT)
RETURNS TABLE(
  entity_type TEXT,
  entity_id TEXT,
  operation TEXT,
  user_name TEXT,
  amount TEXT,
  currency TEXT,
  extra JSONB
) AS $$
DECLARE
  booking_match TEXT;
  car_match TEXT;
  client_match TEXT;
  user_match TEXT;
  payment_ids TEXT[];
  payment_match TEXT[];
  direction TEXT;
  method TEXT := 'cash';
BEGIN
  entity_type := NULL;
  entity_id := NULL;
  operation := NULL;
  user_name := NULL;
  amount := NULL;
  currency := NULL;
  extra := '{}'::jsonb;
  
  IF description_text IS NULL OR description_text = '' THEN
    RETURN;
  END IF;
  
  -- Имя пользователя
  user_match := substring(description_text from '^([А-Яа-яЁёA-Za-z\s]+?)\s+(изменил|создал|принял|выдал|удалил|отменил)');
  IF user_match IS NOT NULL THEN
    user_name := trim(user_match);
  END IF;
  
  -- Тип операции
  IF description_text ~* 'создал|created' THEN
    operation := 'create';
  ELSIF description_text ~* 'изменил|changed|updated' THEN
    operation := 'update';
  ELSIF description_text ~* 'удалил|deleted' THEN
    operation := 'delete';
  ELSIF description_text ~* 'принял|accepted|returned' THEN
    operation := 'return';
  ELSIF description_text ~* 'выдал|issued' THEN
    operation := 'issue';
  ELSE
    operation := 'unknown';
  END IF;
  
  -- Брони
  booking_match := substring(description_text from '(?i)(?:бронь|booking|бронирование)[^0-9#№]*(?:[#№]\s*)?(\d+)');
  IF booking_match IS NOT NULL THEN
    entity_type := 'booking';
    entity_id := booking_match;
    extra := '{}'::jsonb;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Платежи (Parser/StarMech/и т.д.)
  payment_ids := ARRAY[]::TEXT[];
  FOR payment_match IN
    SELECT regexp_matches(description_text, '(?:плат(?:е|ё)ж(?:и)?[^\d]*(\d+(?:/\d+)*))', 'gi')
  LOOP
    payment_ids := payment_ids || string_to_array(payment_match[1], '/');
  END LOOP;
  
  IF array_length(payment_ids, 1) > 0 THEN
    entity_type := 'payment';
    entity_id := payment_ids[1];
    
    -- Сумма / валюта
    SELECT m[1], upper(m[2]) INTO amount, currency
    FROM regexp_matches(description_text, '([0-9]+(?:[\\.,][0-9]+)?)\s*(GEL|USD|EUR)', 'gi') AS m
    LIMIT 1;
    
    IF amount IS NOT NULL THEN
      amount := replace(amount, ',', '.');
    END IF;
    
    IF currency IS NULL THEN
      currency := 'GEL';
    END IF;
    
    -- Направление платежа
    IF description_text ~* 'расход' OR description_text ~* 'выдал' THEN
      direction := 'expense';
    ELSIF description_text ~* 'принял' OR description_text ~* 'приход' THEN
      direction := 'income';
    ELSE
      direction := NULL;
    END IF;
    
    IF description_text ~* 'безнал' OR description_text ~* 'card' THEN
      method := 'cashless';
    ELSE
      method := 'cash';
    END IF;
    
    extra := jsonb_set(extra, '{payment_ids}', to_jsonb(payment_ids));
    IF direction IS NOT NULL THEN
      extra := jsonb_set(extra, '{payment_direction}', to_jsonb(direction));
    END IF;
    extra := jsonb_set(extra, '{payment_method}', to_jsonb(method));
    
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Авто
  car_match := substring(description_text from '(?i)(?:авто|car|машина|автомобиль)[^0-9#№]*(?:[#№]\s*)?(\d+)');
  IF car_match IS NOT NULL THEN
    entity_type := 'car';
    entity_id := car_match;
    extra := '{}'::jsonb;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Клиенты
  client_match := substring(description_text from '(?i)(?:клиент|client)[^0-9#№]*(?:[#№]\s*)?(\d+)');
  IF client_match IS NOT NULL THEN
    entity_type := 'client';
    entity_id := client_match;
    extra := '{}'::jsonb;
    RETURN NEXT;
    RETURN;
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION parse_history_description(TEXT) IS 
  'Парсинг description из history (поддержка платежей, суммы, направления)';

-- =====================================================
-- 3. Обновленная функция применения изменений
-- =====================================================

DROP FUNCTION IF EXISTS apply_history_changes(
  BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, JSONB
);

CREATE OR REPLACE FUNCTION apply_history_changes(
  history_id BIGINT,
  entity_type_value TEXT,
  entity_id_value TEXT,
  operation_value TEXT,
  branch_code TEXT,
  user_name_value TEXT,
  raw_data_value JSONB,
  description_value TEXT,
  amount_value TEXT,
  currency_value TEXT,
  extra_data JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
  internal_uuid UUID;
  booking_uuid UUID;
  car_uuid UUID;
  client_uuid UUID;
  payment_uuid UUID;
  payment_ids TEXT[];
  payment_id TEXT;
  amount_text TEXT;
  currency_text TEXT;
  direction TEXT;
  method TEXT;
  payment_date TIMESTAMPTZ;
  history_entry JSONB;
  new_status TEXT;
  result BOOLEAN := FALSE;
BEGIN
  IF entity_type_value IS NULL OR entity_id_value IS NULL OR entity_id_value = '' THEN
    RETURN FALSE;
  END IF;
  
  IF extra_data IS NULL THEN
    extra_data := '{}'::jsonb;
  END IF;
  
  -- Общий поиск UUID
  SELECT entity_id INTO internal_uuid
  FROM external_refs
  WHERE system = 'rentprog' 
    AND external_id = entity_id_value 
    AND entity_type = entity_type_value
  LIMIT 1;
  
  CASE entity_type_value
    WHEN 'booking' THEN
      IF internal_uuid IS NULL THEN
        RETURN FALSE;
      END IF;
      
      history_entry := jsonb_strip_nulls(jsonb_build_object(
        'history_id', history_id,
        'operation', operation_value,
        'description', description_value,
        'user_name', user_name_value,
        'branch', branch_code,
        'extra', extra_data,
        'raw', raw_data_value,
        'amount', amount_value,
        'currency', currency_value,
        'created_at', NOW()
      ));
      
      new_status := NULL;
      IF operation_value = 'issue' THEN
        new_status := 'active';
      ELSIF operation_value = 'return' THEN
        new_status := 'completed';
      ELSIF operation_value = 'create' THEN
        new_status := 'planned';
      END IF;
      
      UPDATE bookings
      SET 
        status = COALESCE(new_status, status),
        updated_at = NOW(),
        history_log = COALESCE(history_log, '[]'::jsonb) || jsonb_build_array(history_entry)
      WHERE id = internal_uuid;
      result := TRUE;
      
    WHEN 'car' THEN
      IF internal_uuid IS NULL THEN
        RETURN FALSE;
      END IF;
      IF raw_data_value IS NOT NULL AND operation_value = 'update' THEN
        UPDATE cars
        SET 
          updated_at = NOW(),
          data = COALESCE(data, '{}'::jsonb) || raw_data_value
        WHERE id = internal_uuid;
        result := TRUE;
      END IF;
      
    WHEN 'client' THEN
      IF internal_uuid IS NULL THEN
        RETURN FALSE;
      END IF;
      IF raw_data_value IS NOT NULL AND operation_value = 'update' THEN
        UPDATE clients
        SET 
          updated_at = NOW(),
          data = COALESCE(data, '{}'::jsonb) || raw_data_value
        WHERE id = internal_uuid;
        result := TRUE;
      END IF;
      
    WHEN 'payment' THEN
      payment_ids := ARRAY[entity_id_value];
      IF extra_data ? 'payment_ids' THEN
        payment_ids := payment_ids || ARRAY(
          SELECT jsonb_array_elements_text(extra_data->'payment_ids')
        );
      END IF;
      
      payment_ids := ARRAY(
        SELECT DISTINCT val FROM unnest(payment_ids) AS val
        WHERE val IS NOT NULL AND val <> ''
      );
      
      IF array_length(payment_ids, 1) = 0 THEN
        RETURN FALSE;
      END IF;
      
      amount_text := COALESCE(amount_value, raw_data_value->>'sum', '0');
      amount_text := replace(amount_text, ',', '.');
      currency_text := COALESCE(currency_value, upper(raw_data_value->>'currency'), 'GEL');
      direction := COALESCE(extra_data->>'payment_direction', CASE WHEN operation_value = 'create' THEN 'income' ELSE 'unknown' END);
      method := COALESCE(extra_data->>'payment_method', 'cash');
      
      payment_date := NULL;
      IF raw_data_value ? 'created_at' THEN
        BEGIN
          payment_date := (raw_data_value->>'created_at')::timestamptz;
        EXCEPTION WHEN others THEN
          payment_date := NULL;
        END;
      END IF;
      payment_date := COALESCE(payment_date, NOW());
      
      FOR payment_id IN SELECT unnest(payment_ids)
      LOOP
        CONTINUE WHEN payment_id IS NULL OR payment_id = '';
        BEGIN
          SELECT entity_id INTO payment_uuid
          FROM external_refs
          WHERE system = 'rentprog'
            AND entity_type = 'payment'
            AND external_id = payment_id
          LIMIT 1;
          
          IF payment_uuid IS NULL THEN
            INSERT INTO payments (
              branch,
              payment_date,
              payment_type,
              payment_method,
              amount,
              currency,
              description,
              rp_payment_id,
              raw_data
            )
            VALUES (
              branch_code,
              payment_date,
              direction,
              method,
              amount_text,
              currency_text,
              description_value,
              payment_id::int,
              raw_data_value
            )
            ON CONFLICT (branch, rp_payment_id)
            DO UPDATE SET
              payment_date = EXCLUDED.payment_date,
              amount = EXCLUDED.amount,
              currency = EXCLUDED.currency,
              description = EXCLUDED.description
            RETURNING id INTO payment_uuid;
            
            INSERT INTO external_refs (
              entity_type,
              entity_id,
              system,
              external_id,
              branch_code,
              created_at,
              updated_at
            )
            VALUES (
              'payment',
              payment_uuid,
              'rentprog',
              payment_id,
              branch_code,
              NOW(),
              NOW()
            )
            ON CONFLICT DO NOTHING;
          END IF;
          
          result := TRUE;
        EXCEPTION
          WHEN invalid_text_representation THEN
            CONTINUE;
        END;
      END LOOP;
      
    ELSE
      IF internal_uuid IS NULL THEN
        RETURN FALSE;
      END IF;
      result := FALSE;
  END CASE;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION apply_history_changes(
  BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, JSONB
) IS 
  'Применение изменений из history (создание платежей при необходимости)';

-- =====================================================
-- 4. Обновленный триггер
-- =====================================================

DROP FUNCTION IF EXISTS auto_process_history_trigger();

CREATE OR REPLACE FUNCTION auto_process_history_trigger()
RETURNS TRIGGER AS $$
DECLARE
  parsed RECORD;
  applied BOOLEAN;
  notes_text TEXT;
BEGIN
  IF NEW.processed = TRUE THEN
    RETURN NEW;
  END IF;
  
  IF NEW.description IS NULL OR NEW.description = '' THEN
    RETURN NEW;
  END IF;
  
  SELECT * INTO parsed
  FROM parse_history_description(NEW.description)
  LIMIT 1;
  
  IF parsed.entity_type IS NULL OR parsed.entity_id IS NULL THEN
    NEW.notes := COALESCE(NEW.notes, '') || ' | Не удалось распарсить description';
    RETURN NEW;
  END IF;
  
  IF parsed.extra IS NULL THEN
    parsed.extra := '{}'::jsonb;
  END IF;
  
  IF NEW.entity_type IS NULL THEN
    NEW.entity_type := parsed.entity_type;
  END IF;
  
  IF NEW.entity_id IS NULL THEN
    NEW.entity_id := parsed.entity_id;
  END IF;
  
  IF NEW.user_name IS NULL AND parsed.user_name IS NOT NULL THEN
    NEW.user_name := parsed.user_name;
  END IF;
  
  applied := apply_history_changes(
    NEW.id,
    parsed.entity_type,
    parsed.entity_id,
    parsed.operation,
    NEW.branch,
    COALESCE(NEW.user_name, parsed.user_name),
    NEW.raw_data,
    NEW.description,
    parsed.amount,
    parsed.currency,
    parsed.extra
  );
  
  IF applied THEN
    NEW.processed := TRUE;
    NEW.notes := COALESCE(NEW.notes, '') || ' | Обработано автоматически через триггер';
  ELSE
    notes_text := ' | Парсинг успешен, но изменения не применены (сущность не найдена в БД?)';
    NEW.notes := COALESCE(NEW.notes, '') || notes_text;
  END IF;
  
  PERFORM pg_notify(
    'history_item_processed',
    NEW.id::TEXT || '|' || NEW.branch || '|' ||
    COALESCE(parsed.entity_type, 'unknown') || '|' ||
    COALESCE(parsed.entity_id, '')
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_process_history_trigger() IS 
  'Триггер с поддержкой платежей и расширенным парсером history';

CREATE TRIGGER auto_process_history_trigger
  BEFORE INSERT OR UPDATE ON history
  FOR EACH ROW
  WHEN (NEW.processed IS NULL OR NEW.processed = FALSE)
  EXECUTE FUNCTION auto_process_history_trigger();

COMMENT ON TRIGGER auto_process_history_trigger ON history IS
  'Автоматическая обработка history с поддержкой платежей';

