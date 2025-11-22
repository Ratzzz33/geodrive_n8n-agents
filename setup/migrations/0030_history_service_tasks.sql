-- =====================================================
-- Миграция 0030: Обслуживание → задачи по авто
-- Дата: 2025-11-14
-- =====================================================

-- 1. Обновляем парсер history (добавляем обслуживание)

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
  service_id_match TEXT;
  service_object_match TEXT;
  service_action_match TEXT;
  service_summary TEXT;
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
  user_match := substring(description_text from '^([А-Яа-яЁёA-Za-z\s]+?)\s+(изменил|создал|принял|выдал|удалил|отменил|завершил)');
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
  ELSIF description_text ~* 'завершил' THEN
    operation := 'complete';
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
  
  -- Обслуживание (service tasks)
  IF description_text ~* 'обслужив' THEN
    service_action_match := substring(description_text from '(?i)(создал|завершил|удалил)\s+обслуживание');
    service_id_match := substring(description_text from '(?i)обслуживание[^0-9#№]*(?:[#№]\s*)?(\d+)');
    service_object_match := substring(description_text from '(?i)(?:объекте|object)[^0-9#№]*(?:[#№]\s*)?(\d+)');
    
    service_summary := NULL;
    IF description_text ~* '(?:объекте|object)[^#№\d]*(?:[#№]\s*)?\d+\s+(.+)$' THEN
      service_summary := btrim(
        regexp_replace(
          description_text,
          '.*(?:объекте|object)[^#№\d]*(?:[#№]\s*)?\d+\s*',
          '',
          1,
          1,
          'i'
        )
      );
    END IF;
    
    IF service_id_match IS NOT NULL THEN
      entity_type := 'car';
      entity_id := service_object_match;
      extra := jsonb_set(extra, '{service}', jsonb_strip_nulls(jsonb_build_object(
        'service_id', service_id_match,
        'object_id', service_object_match,
        'action', CASE 
                    WHEN service_action_match ILIKE 'создал%' THEN 'created'
                    WHEN service_action_match ILIKE 'завершил%' THEN 'completed'
                    WHEN service_action_match ILIKE 'удалил%' THEN 'deleted'
                    ELSE NULL
                  END,
        'summary', service_summary
      )));
      RETURN NEXT;
      RETURN;
    END IF;
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
  'Парсинг description из history (платежи, брони, обслуживание авто)';

-- -----------------------------------------------------
-- 2. Функция обработки обслуживания через задачи
-- -----------------------------------------------------

DROP FUNCTION IF EXISTS process_car_service_task(
  BIGINT, UUID, TEXT, TEXT, TEXT, JSONB, TEXT
);

CREATE OR REPLACE FUNCTION process_car_service_task(
  history_id BIGINT,
  car_uuid UUID,
  car_external_id TEXT,
  branch_code TEXT,
  user_name_value TEXT,
  service_info JSONB,
  description_value TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  service_id TEXT;
  object_external_id TEXT;
  action TEXT;
  summary TEXT;
  task_uuid UUID;
  branch_uuid UUID;
  payload JSONB;
  status_value TEXT;
  event_name TEXT;
BEGIN
  IF service_info IS NULL THEN
    RETURN FALSE;
  END IF;
  
  service_id := service_info->>'service_id';
  object_external_id := COALESCE(service_info->>'object_id', car_external_id);
  action := lower(COALESCE(service_info->>'action', 'created'));
  summary := COALESCE(
    NULLIF(service_info->>'summary', ''),
    description_value,
    format('Обслуживание #%s', service_id)
  );
  
  IF service_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  SELECT branch_id INTO branch_uuid
  FROM cars
  WHERE id = car_uuid;
  
  SELECT entity_id INTO task_uuid
  FROM external_refs
  WHERE system = 'rentprog'
    AND entity_type = 'task'
    AND external_id = service_id
  LIMIT 1;
  
  IF action IN ('created', 'assigned', 'planned') THEN
    status_value := 'todo';
    event_name := 'created_from_history';
    
    IF task_uuid IS NULL THEN
      INSERT INTO tasks (
        title, description, status, priority,
        branch_id, source
      )
      VALUES (
        format('ТО #%s', service_id),
        summary,
        status_value,
        'normal',
        branch_uuid,
        'rentprog_history'
      )
      RETURNING id INTO task_uuid;
      
      INSERT INTO task_links (task_id, entity_type, entity_id)
      VALUES (task_uuid, 'car', car_uuid)
      ON CONFLICT DO NOTHING;
      
      INSERT INTO external_refs (
        entity_type, entity_id, system, external_id, branch_code, created_at, updated_at
      )
      VALUES (
        'task', task_uuid, 'rentprog', service_id, branch_code, NOW(), NOW()
      )
      ON CONFLICT (system, external_id)
      DO UPDATE SET entity_id = EXCLUDED.entity_id, updated_at = NOW();
    ELSE
      UPDATE tasks
      SET status = status_value,
          description = summary,
          updated_at = NOW()
      WHERE id = task_uuid;
      
      INSERT INTO task_links (task_id, entity_type, entity_id)
      VALUES (task_uuid, 'car', car_uuid)
      ON CONFLICT DO NOTHING;
      
      event_name := 'reopened_from_history';
    END IF;
    
    INSERT INTO task_events (task_id, event, payload)
    VALUES (
      task_uuid,
      event_name,
      jsonb_strip_nulls(jsonb_build_object(
        'history_id', history_id,
        'service_id', service_id,
        'object_external_id', object_external_id,
        'user_name', user_name_value
      ))
    );
    
  ELSIF action = 'completed' THEN
    status_value := 'done';
    
    IF task_uuid IS NULL THEN
      INSERT INTO tasks (
        title, description, status, priority,
        branch_id, source
      )
      VALUES (
        format('ТО #%s', service_id),
        summary,
        status_value,
        'normal',
        branch_uuid,
        'rentprog_history'
      )
      RETURNING id INTO task_uuid;
      
      INSERT INTO task_links (task_id, entity_type, entity_id)
      VALUES (task_uuid, 'car', car_uuid)
      ON CONFLICT DO NOTHING;
      
      INSERT INTO external_refs (
        entity_type, entity_id, system, external_id, branch_code, created_at, updated_at
      )
      VALUES (
        'task', task_uuid, 'rentprog', service_id, branch_code, NOW(), NOW()
      )
      ON CONFLICT (system, external_id)
      DO UPDATE SET entity_id = EXCLUDED.entity_id, updated_at = NOW();
    END IF;
    
    UPDATE tasks
    SET status = status_value,
        updated_at = NOW()
    WHERE id = task_uuid;
    
    INSERT INTO task_events (task_id, event, payload)
    VALUES (
      task_uuid,
      'completed_from_history',
      jsonb_strip_nulls(jsonb_build_object(
        'history_id', history_id,
        'service_id', service_id,
        'object_external_id', object_external_id,
        'user_name', user_name_value
      ))
    );
    
  ELSIF action = 'deleted' THEN
    status_value := 'cancelled';
    
    IF task_uuid IS NULL THEN
      INSERT INTO tasks (
        title, description, status, priority,
        branch_id, source
      )
      VALUES (
        format('ТО #%s', service_id),
        summary,
        status_value,
        'normal',
        branch_uuid,
        'rentprog_history'
      )
      RETURNING id INTO task_uuid;
      
      INSERT INTO task_links (task_id, entity_type, entity_id)
      VALUES (task_uuid, 'car', car_uuid)
      ON CONFLICT DO NOTHING;
      
      INSERT INTO external_refs (
        entity_type, entity_id, system, external_id, branch_code, created_at, updated_at
      )
      VALUES (
        'task', task_uuid, 'rentprog', service_id, branch_code, NOW(), NOW()
      )
      ON CONFLICT (system, external_id)
      DO UPDATE SET entity_id = EXCLUDED.entity_id, updated_at = NOW();
    END IF;
    
    UPDATE tasks
    SET status = status_value,
        updated_at = NOW()
    WHERE id = task_uuid;
    
    INSERT INTO task_events (task_id, event, payload)
    VALUES (
      task_uuid,
      'cancelled_from_history',
      jsonb_strip_nulls(jsonb_build_object(
        'history_id', history_id,
        'service_id', service_id,
        'object_external_id', object_external_id,
        'user_name', user_name_value
      ))
    );
    
  ELSE
    RETURN FALSE;
  END IF;
  
  payload := jsonb_strip_nulls(jsonb_build_object(
    'service_id', service_id,
    'object_external_id', object_external_id,
    'task_id', task_uuid,
    'status', status_value
  ));
  
  INSERT INTO entity_timeline (
    entity_type,
    entity_id,
    source_type,
    source_id,
    event_type,
    operation,
    summary,
    details,
    branch_code,
    user_name,
    created_at
  )
  VALUES (
    'car',
    car_uuid,
    'rentprog_history',
    history_id::TEXT,
    'car.maintenance.task',
    action,
    summary,
    payload,
    branch_code,
    user_name_value,
    NOW()
  );
  
  UPDATE cars
  SET history_log = COALESCE(history_log, '[]'::jsonb) || jsonb_build_array(
    jsonb_strip_nulls(jsonb_build_object(
      'ts', NOW(),
      'type', 'maintenance_task',
      'service_id', service_id,
      'action', action,
      'task_id', task_uuid,
      'summary', summary,
      'user', user_name_value
    ))
  )
  WHERE id = car_uuid;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_car_service_task(
  BIGINT, UUID, TEXT, TEXT, TEXT, JSONB, TEXT
) IS 'Создание / обновление задач обслуживания по событиям history';

-- -----------------------------------------------------
-- 3. Обновленная функция apply_history_changes
-- -----------------------------------------------------

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
      
      IF extra_data ? 'service' THEN
        result := process_car_service_task(
          history_id,
          internal_uuid,
          entity_id_value,
          branch_code,
          user_name_value,
          extra_data->'service',
          description_value
        );
      ELSIF raw_data_value IS NOT NULL AND operation_value = 'update' THEN
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
) IS 'Применение изменений из history (платежи, брони, обслуживание через задачи)';

-- =====================================================
-- Конец миграции 0030
-- =====================================================

