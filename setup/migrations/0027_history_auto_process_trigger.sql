-- Миграция 0027: Автоматическая обработка history через триггеры БД
-- Дата: 2025-11-14
-- Назначение: Триггер автоматически обрабатывает записи history и применяет изменения к соответствующим таблицам

-- =====================================================
-- 1. Функция для парсинга description и извлечения ID
-- =====================================================

CREATE OR REPLACE FUNCTION parse_history_description(description_text TEXT)
RETURNS TABLE(
  entity_type TEXT,
  entity_id TEXT,
  operation TEXT,
  user_name TEXT
) AS $$
DECLARE
  booking_match TEXT;
  payment_match TEXT;
  car_match TEXT;
  client_match TEXT;
  user_match TEXT;
  operation_type TEXT;
BEGIN
  -- Инициализация
  entity_type := NULL;
  entity_id := NULL;
  operation := NULL;
  user_name := NULL;
  
  IF description_text IS NULL OR description_text = '' THEN
    RETURN;
  END IF;
  
  -- Извлечение имени пользователя (обычно в начале описания)
  -- Формат: "Имя Фамилия изменил/создал/принял..."
  user_match := substring(description_text from '^([А-Яа-яЁёA-Za-z\s]+?)\s+(изменил|создал|принял|выдал|удалил|отменил)');
  IF user_match IS NOT NULL THEN
    user_name := trim(user_match);
  END IF;
  
  -- Определение операции
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
  
  -- Поиск ID брони (№ 506974, booking #506974, бронь № 506974)
  booking_match := substring(description_text from '(?:бронь|booking|бронирование)[\s#№]*(\d+)');
  IF booking_match IS NOT NULL THEN
    entity_type := 'booking';
    entity_id := booking_match;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Поиск ID платежа (платёж №1840037, payment #1840037)
  payment_match := substring(description_text from '(?:плат[ёе]ж|payment)[\s#№]*(\d+)');
  IF payment_match IS NOT NULL THEN
    entity_type := 'payment';
    entity_id := payment_match;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Поиск ID авто (авто № 61630, car #61630)
  car_match := substring(description_text from '(?:авто|car|машина|автомобиль)[\s#№]*(\d+)');
  IF car_match IS NOT NULL THEN
    entity_type := 'car';
    entity_id := car_match;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Поиск ID клиента (клиент № 381606, client #381606)
  client_match := substring(description_text from '(?:клиент|client)[\s#№]*(\d+)');
  IF client_match IS NOT NULL THEN
    entity_type := 'client';
    entity_id := client_match;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Если ничего не найдено, возвращаем NULL
  RETURN;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION parse_history_description(TEXT) IS 
  'Парсинг description из history для извлечения типа сущности, ID и операции';

-- =====================================================
-- 2. Функция для применения изменений к таблицам
-- =====================================================

CREATE OR REPLACE FUNCTION apply_history_changes(
  history_id BIGINT,
  entity_type_value TEXT,
  entity_id_value TEXT,
  operation_value TEXT,
  branch_code TEXT,
  raw_data_value JSONB,
  description_value TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  internal_uuid UUID;
  booking_uuid UUID;
  car_uuid UUID;
  client_uuid UUID;
  payment_uuid UUID;
  result BOOLEAN := FALSE;
BEGIN
  -- Пропускаем если нет entity_type или entity_id
  IF entity_type_value IS NULL OR entity_id_value IS NULL OR entity_id_value = '' THEN
    RETURN FALSE;
  END IF;
  
  -- Получаем внутренний UUID через external_refs
  SELECT entity_id INTO internal_uuid
  FROM external_refs
  WHERE system = 'rentprog' 
    AND external_id = entity_id_value 
    AND entity_type = entity_type_value
  LIMIT 1;
  
  -- Если не нашли UUID, пропускаем (сущность еще не создана в нашей БД)
  IF internal_uuid IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Применяем изменения в зависимости от типа сущности
  CASE entity_type_value
    WHEN 'booking' THEN
      -- Обновление брони (если есть изменения в raw_data)
      IF raw_data_value IS NOT NULL AND operation_value = 'update' THEN
        -- Здесь можно добавить логику обновления полей брони из raw_data
        -- Пока просто помечаем как обработанное
        result := TRUE;
      END IF;
      
    WHEN 'car' THEN
      -- Обновление авто (mileage, state, company_id и т.д.)
      IF raw_data_value IS NOT NULL AND operation_value = 'update' THEN
        -- Обновляем данные из raw_data
        UPDATE cars
        SET 
          updated_at = NOW(),
          data = COALESCE(data, '{}'::jsonb) || raw_data_value
        WHERE id = internal_uuid;
        result := TRUE;
      END IF;
      
    WHEN 'client' THEN
      -- Обновление клиента
      IF raw_data_value IS NOT NULL AND operation_value = 'update' THEN
        UPDATE clients
        SET 
          updated_at = NOW(),
          data = COALESCE(data, '{}'::jsonb) || raw_data_value
        WHERE id = internal_uuid;
        result := TRUE;
      END IF;
      
    WHEN 'payment' THEN
      -- Платежи обрабатываются отдельно через payments таблицу
      -- Здесь можно добавить логику если нужно
      result := TRUE;
      
    ELSE
      -- Неизвестный тип сущности
      result := FALSE;
  END CASE;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION apply_history_changes(BIGINT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) IS 
  'Применение изменений из history к соответствующим таблицам';

-- =====================================================
-- 3. Триггер для автоматической обработки history
-- =====================================================

CREATE OR REPLACE FUNCTION auto_process_history_trigger()
RETURNS TRIGGER AS $$
DECLARE
  parsed RECORD;
  applied BOOLEAN;
  notes_text TEXT;
BEGIN
  -- Пропускаем уже обработанные записи
  IF NEW.processed = TRUE THEN
    RETURN NEW;
  END IF;
  
  -- Пропускаем если нет description
  IF NEW.description IS NULL OR NEW.description = '' THEN
    RETURN NEW;
  END IF;
  
  -- Парсим description
  SELECT * INTO parsed
  FROM parse_history_description(NEW.description)
  LIMIT 1;
  
  -- Если не удалось распарсить, оставляем необработанным
  IF parsed.entity_type IS NULL OR parsed.entity_id IS NULL THEN
    NEW.notes := COALESCE(NEW.notes, '') || ' | Не удалось распарсить description';
    RETURN NEW;
  END IF;
  
  -- Обновляем entity_type и entity_id если они пустые
  IF NEW.entity_type IS NULL THEN
    NEW.entity_type := parsed.entity_type;
  END IF;
  
  IF NEW.entity_id IS NULL THEN
    NEW.entity_id := parsed.entity_id;
  END IF;
  
  -- Обновляем user_name если пустой
  IF NEW.user_name IS NULL AND parsed.user_name IS NOT NULL THEN
    NEW.user_name := parsed.user_name;
  END IF;
  
  -- Применяем изменения к таблицам
  applied := apply_history_changes(
    NEW.id,
    parsed.entity_type,
    parsed.entity_id,
    parsed.operation,
    NEW.branch,
    NEW.raw_data,
    NEW.description
  );
  
  -- Если изменения применены успешно, помечаем как обработанное
  IF applied THEN
    NEW.processed := TRUE;
    NEW.notes := COALESCE(NEW.notes, '') || ' | Обработано автоматически через триггер';
  ELSE
    -- Оставляем необработанным для ручной обработки
    notes_text := ' | Парсинг успешен, но изменения не применены (сущность не найдена в БД?)';
    NEW.notes := COALESCE(NEW.notes, '') || notes_text;
  END IF;
  
  -- Отправляем уведомление для асинхронной обработки (если нужно)
  PERFORM pg_notify(
    'history_item_processed',
    NEW.id::TEXT || '|' || 
    NEW.branch || '|' || 
    COALESCE(parsed.entity_type, 'unknown') || '|' || 
    COALESCE(parsed.entity_id, '')
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_process_history_trigger() IS 
  'Триггер для автоматической обработки записей history с парсингом description и применением изменений';

-- =====================================================
-- 4. Создание триггера
-- =====================================================

DROP TRIGGER IF EXISTS auto_process_history_trigger ON history;

CREATE TRIGGER auto_process_history_trigger
  BEFORE INSERT OR UPDATE ON history
  FOR EACH ROW
  WHEN (NEW.processed IS NULL OR NEW.processed = FALSE)
  EXECUTE FUNCTION auto_process_history_trigger();

COMMENT ON TRIGGER auto_process_history_trigger ON history IS 
  'Автоматическая обработка новых записей history с парсингом и применением изменений';

-- =====================================================
-- 5. Функция для получения необработанных записей
-- =====================================================

CREATE OR REPLACE FUNCTION get_pending_history_for_processing(limit_count INTEGER DEFAULT 100)
RETURNS TABLE(
  id BIGINT,
  ts TIMESTAMPTZ,
  branch TEXT,
  operation_type TEXT,
  operation_id TEXT,
  description TEXT,
  entity_type TEXT,
  entity_id TEXT,
  user_name TEXT,
  created_at TIMESTAMPTZ,
  raw_data JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.id,
    h.ts,
    h.branch,
    h.operation_type,
    h.operation_id,
    h.description,
    h.entity_type,
    h.entity_id,
    h.user_name,
    h.created_at,
    h.raw_data
  FROM history h
  WHERE (h.processed IS NULL OR h.processed = FALSE)
    AND h.description IS NOT NULL
    AND h.description != ''
  ORDER BY h.created_at ASC, h.ts ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_pending_history_for_processing(INTEGER) IS 
  'Получение списка необработанных записей history для обработки (от старых к новым)';

-- =====================================================
-- 6. Функция для пометки записи как обработанной
-- =====================================================

CREATE OR REPLACE FUNCTION mark_history_processed(
  history_id BIGINT,
  success BOOLEAN,
  notes_text TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  IF success THEN
    UPDATE history 
    SET processed = TRUE, notes = COALESCE(notes, '') || COALESCE(' | ' || notes_text, '')
    WHERE id = history_id;
  ELSE
    -- При ошибке оставляем processed = FALSE для повторной обработки
    UPDATE history 
    SET notes = COALESCE(notes, '') || COALESCE(' | Ошибка: ' || notes_text, ' | Ошибка обработки')
    WHERE id = history_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mark_history_processed(BIGINT, BOOLEAN, TEXT) IS 
  'Пометка записи history как обработанной (при ошибке оставляет processed = false)';

