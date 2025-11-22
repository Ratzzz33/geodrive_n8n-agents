-- Миграция 0026: Автоматическая обработка событий через триггер БД
-- Дата: 2025-11-14
-- Назначение: Триггер автоматически обрабатывает события при вставке в таблицу events

-- =====================================================
-- 1. Функция для определения branch по company_id
-- =====================================================

CREATE OR REPLACE FUNCTION get_branch_from_company_id(company_id INTEGER)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE company_id
    WHEN 9247 THEN 'tbilisi'
    WHEN 9248 THEN 'kutaisi'
    WHEN 9506 THEN 'batumi'
    WHEN 11163 THEN 'service-center'
    WHEN 11157 THEN 'batumi'
    WHEN 11158 THEN 'batumi'
    WHEN 9110 THEN 'tbilisi'
    ELSE 'tbilisi' -- по умолчанию
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_branch_from_company_id(INTEGER) IS 
  'Определение branch по company_id';

-- =====================================================
-- 2. Функция для извлечения ext_id из события
-- =====================================================

DROP FUNCTION IF EXISTS extract_ext_id_from_event(TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION extract_ext_id_from_event(
  rentprog_id_value TEXT,
  ext_id_value TEXT,
  payload_data JSONB
)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  -- Приоритет: rentprog_id > ext_id > payload.id > payload.car_id > payload.client_id > payload.booking_id
  IF rentprog_id_value IS NOT NULL AND rentprog_id_value != '' THEN
    RETURN rentprog_id_value;
  END IF;
  
  IF ext_id_value IS NOT NULL AND ext_id_value != '' THEN
    RETURN ext_id_value;
  END IF;
  
  IF payload_data IS NOT NULL THEN
    IF payload_data ? 'id' THEN
      RETURN COALESCE(payload_data->>'id', '');
    END IF;
    
    IF payload_data ? 'car_id' THEN
      RETURN COALESCE(payload_data->>'car_id', '');
    END IF;
    
    IF payload_data ? 'client_id' THEN
      RETURN COALESCE(payload_data->>'client_id', '');
    END IF;
    
    IF payload_data ? 'booking_id' THEN
      RETURN COALESCE(payload_data->>'booking_id', '');
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION extract_ext_id_from_event(TEXT, TEXT, JSONB) IS 
  'Извлечение ext_id из события (приоритет: rentprog_id > ext_id > payload)';

-- =====================================================
-- 3. Функция для нормализации payload (обработка массивов)
-- =====================================================

CREATE OR REPLACE FUNCTION normalize_event_payload(payload JSONB)
RETURNS JSONB AS $$
DECLARE
  normalized JSONB := '{}'::jsonb;
  key TEXT;
  value JSONB;
  array_value JSONB;
  array_length INTEGER;
BEGIN
  -- Нормализуем все поля в payload
  FOR key, value IN SELECT * FROM jsonb_each(payload)
  LOOP
    -- Пропускаем служебные поля
    IF key IN ('id', 'car_id', 'client_id', 'booking_id') THEN
      CONTINUE;
    END IF;
    
    -- Обработка массивов: берем последнее значение
    IF jsonb_typeof(value) = 'array' THEN
      array_value := value;
      array_length := jsonb_array_length(array_value);
      IF array_length > 0 THEN
        normalized := normalized || jsonb_build_object(key, array_value->(array_length - 1));
      END IF;
    ELSE
      -- Остальные значения оставляем как есть
      normalized := normalized || jsonb_build_object(key, value);
    END IF;
  END LOOP;
  
  RETURN normalized;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION normalize_event_payload(JSONB) IS 
  'Нормализация payload: обработка массивов (берет последнее значение)';

-- =====================================================
-- 4. Триггер для автоматической обработки событий
-- =====================================================

CREATE OR REPLACE FUNCTION auto_process_event_trigger()
RETURNS TRIGGER AS $$
DECLARE
  branch_code TEXT;
  ext_id_value TEXT;
  event_type_value TEXT;
  normalized_payload JSONB;
  http_request TEXT;
  http_response TEXT;
  response_ok BOOLEAN;
  error_message TEXT;
BEGIN
  -- Пропускаем уже обработанные события
  IF NEW.processed = TRUE THEN
    RETURN NEW;
  END IF;
  
  -- Нормализуем payload (обработка массивов)
  IF NEW.payload IS NOT NULL THEN
    normalized_payload := normalize_event_payload(NEW.payload);
    NEW.payload := normalized_payload;
  END IF;
  
  -- Определяем branch
  branch_code := get_branch_from_company_id(NEW.company_id);
  
  -- Если есть metadata с branch, используем его
  IF NEW.metadata IS NOT NULL AND jsonb_typeof(NEW.metadata) = 'object' AND NEW.metadata ? 'branch' THEN
    branch_code := NEW.metadata->>'branch';
  END IF;
  
  -- Извлекаем ext_id
  ext_id_value := extract_ext_id_from_event(NEW.rentprog_id, NEW.ext_id, NEW.payload);
  
  -- Если нет ext_id, оставляем необработанным (будет обработано позже)
  IF ext_id_value IS NULL OR ext_id_value = '' THEN
    RETURN NEW;
  END IF;
  
  -- Определяем тип события
  event_type_value := COALESCE(NEW.event_name, NEW.type, 'unknown');
  
  -- Отправляем уведомление через pg_notify для асинхронной обработки
  -- Формат: event_id|branch|type|ext_id
  PERFORM pg_notify(
    'rentprog_event_auto_process',
    NEW.id::TEXT || '|' || 
    branch_code || '|' || 
    event_type_value || '|' || 
    ext_id_value
  );
  
  -- НЕ помечаем как processed здесь - это сделает внешний обработчик после успешной обработки
  -- При ошибках событие останется processed = false для повторной обработки
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_process_event_trigger() IS 
  'Триггер для автоматической обработки событий через pg_notify (асинхронно)';

-- =====================================================
-- 5. Создание триггера
-- =====================================================

DROP TRIGGER IF EXISTS auto_process_event_trigger ON events;

CREATE TRIGGER auto_process_event_trigger
  AFTER INSERT ON events
  FOR EACH ROW
  WHEN (NEW.processed IS NULL OR NEW.processed = FALSE)
  EXECUTE FUNCTION auto_process_event_trigger();

COMMENT ON TRIGGER auto_process_event_trigger ON events IS 
  'Автоматическая обработка новых событий через pg_notify';

-- =====================================================
-- 6. Функция для обработки уведомлений (для внешнего сервиса)
-- =====================================================

-- Эта функция будет использоваться внешним сервисом (Jarvis API или n8n)
-- для обработки уведомлений pg_notify

CREATE OR REPLACE FUNCTION get_pending_events_for_processing(limit_count INTEGER DEFAULT 50)
RETURNS TABLE(
  id BIGINT,
  ts TIMESTAMPTZ,
  branch TEXT,
  type TEXT,
  ext_id TEXT,
  event_name TEXT,
  entity_type TEXT,
  operation TEXT,
  company_id INTEGER,
  payload JSONB,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.ts,
    get_branch_from_company_id(e.company_id) as branch,
    COALESCE(e.event_name, e.type, 'unknown') as type,
    extract_ext_id_from_event(e.rentprog_id, e.ext_id, e.payload) as ext_id,
    e.event_name,
    e.entity_type,
    e.operation,
    e.company_id,
    e.payload,
    e.metadata
  FROM events e
  WHERE (e.processed IS NULL OR e.processed = FALSE)
    AND extract_ext_id_from_event(e.rentprog_id, e.ext_id, e.payload) IS NOT NULL
    AND extract_ext_id_from_event(e.rentprog_id, e.ext_id, e.payload) != ''
  ORDER BY e.ts ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_pending_events_for_processing(INTEGER) IS 
  'Получение списка необработанных событий для обработки';

-- =====================================================
-- 7. Функция для пометки события как обработанного
-- =====================================================

CREATE OR REPLACE FUNCTION mark_event_processed(
  event_id BIGINT,
  success BOOLEAN,
  error_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  IF success THEN
    UPDATE events 
    SET processed = TRUE, ok = TRUE, reason = NULL
    WHERE id = event_id;
  ELSE
    -- При ошибке оставляем processed = FALSE для повторной обработки
    UPDATE events 
    SET ok = FALSE, reason = COALESCE(error_reason, 'Unknown error')
    WHERE id = event_id;
    -- НЕ устанавливаем processed = TRUE, чтобы событие можно было обработать повторно
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mark_event_processed(BIGINT, BOOLEAN, TEXT) IS 
  'Пометка события как обработанного (при ошибке оставляет processed = false)';

