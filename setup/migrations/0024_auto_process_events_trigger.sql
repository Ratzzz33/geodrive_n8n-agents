-- Миграция 0024: Автоматическая обработка событий через триггеры БД
-- Дата: 2025-11-14
-- Назначение: Автоматическая обработка событий при вставке в таблицу events

-- =====================================================
-- 1. Функция для обработки события через HTTP
-- =====================================================

-- Проверяем наличие расширения pg_net (для HTTP запросов)
-- Если нет - используем альтернативный подход через LISTEN/NOTIFY

-- Вариант 1: Использование pg_net (если доступно)
DO $$
BEGIN
  -- Проверяем наличие pg_net
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_net extension found, using HTTP requests';
  ELSE
    RAISE NOTICE 'pg_net extension not found, using LISTEN/NOTIFY approach';
  END IF;
END $$;

-- Функция для определения branch по company_id
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

-- Функция для извлечения ext_id из payload
CREATE OR REPLACE FUNCTION extract_ext_id_from_event(
  rentprog_id TEXT,
  ext_id TEXT,
  payload JSONB
)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  -- Приоритет: rentprog_id > ext_id > payload.id > payload.car_id > payload.client_id > payload.booking_id
  IF rentprog_id IS NOT NULL AND rentprog_id != '' THEN
    RETURN rentprog_id;
  END IF;
  
  IF ext_id IS NOT NULL AND ext_id != '' THEN
    RETURN ext_id;
  END IF;
  
  IF payload IS NOT NULL THEN
    result := COALESCE(
      payload->>'id',
      payload->>'car_id',
      payload->>'client_id',
      payload->>'booking_id'
    );
    
    IF result IS NOT NULL AND result != '' THEN
      RETURN result;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 2. Функция триггера для автоматической обработки
-- =====================================================

CREATE OR REPLACE FUNCTION auto_process_event_trigger()
RETURNS TRIGGER AS $$
DECLARE
  branch_code TEXT;
  ext_id_value TEXT;
  event_type_value TEXT;
  jarvis_api_url TEXT := 'http://46.224.17.15:3000/process-event';
  -- Используем pg_notify для отправки события внешнему обработчику
  -- Внешний сервис (n8n или отдельный worker) будет слушать эти уведомления
BEGIN
  -- Пропускаем уже обработанные события
  IF NEW.processed = TRUE THEN
    RETURN NEW;
  END IF;
  
  -- Определяем branch
  branch_code := get_branch_from_company_id(NEW.company_id);
  
  -- Если есть metadata с branch, используем его
  IF NEW.metadata IS NOT NULL AND NEW.metadata ? 'branch' THEN
    branch_code := NEW.metadata->>'branch';
  END IF;
  
  -- Извлекаем ext_id
  ext_id_value := extract_ext_id_from_event(NEW.rentprog_id, NEW.ext_id, NEW.payload);
  
  -- Если нет ext_id, пропускаем (будет обработано позже вручную)
  IF ext_id_value IS NULL OR ext_id_value = '' THEN
    RETURN NEW;
  END IF;
  
  -- Определяем тип события
  event_type_value := COALESCE(NEW.event_name, NEW.type, 'unknown');
  
  -- Отправляем уведомление через pg_notify
  -- Формат: event_id|branch|type|ext_id
  PERFORM pg_notify(
    'rentprog_event_processed',
    NEW.id::TEXT || '|' || 
    branch_code || '|' || 
    event_type_value || '|' || 
    ext_id_value
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. Создание триггера
-- =====================================================

DROP TRIGGER IF EXISTS auto_process_event_on_insert ON events;

CREATE TRIGGER auto_process_event_on_insert
  AFTER INSERT ON events
  FOR EACH ROW
  WHEN (NEW.processed IS NULL OR NEW.processed = FALSE)
  EXECUTE FUNCTION auto_process_event_trigger();

-- Комментарии
COMMENT ON FUNCTION auto_process_event_trigger() IS 
  'Триггер для автоматической обработки событий через pg_notify';
COMMENT ON FUNCTION get_branch_from_company_id(INTEGER) IS 
  'Определение branch по company_id';
COMMENT ON FUNCTION extract_ext_id_from_event(TEXT, TEXT, JSONB) IS 
  'Извлечение ext_id из различных источников';

-- =====================================================
-- 4. Альтернативный вариант: Прямой HTTP вызов (если pg_net доступен)
-- =====================================================

-- Функция для прямого HTTP вызова (требует pg_net)
CREATE OR REPLACE FUNCTION process_event_via_http(
  event_id BIGINT,
  branch_code TEXT,
  event_type TEXT,
  ext_id TEXT
)
RETURNS VOID AS $$
DECLARE
  jarvis_api_url TEXT := 'http://46.224.17.15:3000/process-event';
  request_body JSONB;
  response_status INTEGER;
BEGIN
  -- Формируем тело запроса
  request_body := jsonb_build_object(
    'branch', branch_code,
    'type', event_type,
    'ext_id', ext_id,
    'rentprog_id', ext_id,
    'eventId', event_id
  );
  
  -- Выполняем HTTP запрос (требует pg_net)
  -- Если pg_net недоступен, эта функция не будет работать
  -- В этом случае используем pg_notify подход
  
  -- Пример для pg_net (раскомментировать если расширение установлено):
  /*
  SELECT status INTO response_status
  FROM net.http_post(
    url := jarvis_api_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := request_body::text
  );
  
  -- Обновляем статус события
  IF response_status = 200 THEN
    UPDATE events SET processed = true, ok = true WHERE id = event_id;
  ELSE
    UPDATE events SET processed = true, ok = false, reason = 'HTTP ' || response_status WHERE id = event_id;
  END IF;
  */
  
  -- Если pg_net недоступен, просто отправляем уведомление
  PERFORM pg_notify(
    'rentprog_event_processed',
    event_id::TEXT || '|' || branch_code || '|' || event_type || '|' || ext_id
  );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. Индекс для быстрого поиска необработанных событий
-- =====================================================

-- Индекс уже должен существовать, но проверим
CREATE INDEX IF NOT EXISTS idx_events_processed_ts 
  ON events(processed, ts) 
  WHERE processed = FALSE OR processed IS NULL;

-- =====================================================
-- 6. Функция для ручной обработки всех необработанных событий
-- =====================================================

CREATE OR REPLACE FUNCTION process_all_unprocessed_events()
RETURNS TABLE(
  processed_count INTEGER,
  error_count INTEGER
) AS $$
DECLARE
  event_record RECORD;
  branch_code TEXT;
  ext_id_value TEXT;
  event_type_value TEXT;
  success_count INTEGER := 0;
  fail_count INTEGER := 0;
BEGIN
  -- Обрабатываем все необработанные события
  FOR event_record IN
    SELECT id, company_id, rentprog_id, ext_id, payload, metadata, event_name, type
    FROM events
    WHERE processed IS NULL OR processed = FALSE
    ORDER BY ts ASC
  LOOP
    -- Определяем branch
    branch_code := get_branch_from_company_id(event_record.company_id);
    
    IF event_record.metadata IS NOT NULL AND event_record.metadata ? 'branch' THEN
      branch_code := event_record.metadata->>'branch';
    END IF;
    
    -- Извлекаем ext_id
    ext_id_value := extract_ext_id_from_event(
      event_record.rentprog_id,
      event_record.ext_id,
      event_record.payload
    );
    
    -- Пропускаем если нет ext_id
    IF ext_id_value IS NULL OR ext_id_value = '' THEN
      UPDATE events 
      SET processed = TRUE, ok = FALSE, reason = 'No ext_id found'
      WHERE id = event_record.id;
      fail_count := fail_count + 1;
      CONTINUE;
    END IF;
    
    -- Определяем тип события
    event_type_value := COALESCE(event_record.event_name, event_record.type, 'unknown');
    
    -- Отправляем уведомление
    PERFORM pg_notify(
      'rentprog_event_processed',
      event_record.id::TEXT || '|' || 
      branch_code || '|' || 
      event_type_value || '|' || 
      ext_id_value
    );
    
    success_count := success_count + 1;
  END LOOP;
  
  RETURN QUERY SELECT success_count, fail_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_all_unprocessed_events() IS 
  'Обработка всех необработанных событий через pg_notify';

