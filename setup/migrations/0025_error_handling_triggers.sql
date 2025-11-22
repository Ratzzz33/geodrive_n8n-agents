-- Миграция 0025: Триггеры для обработки ошибок событий
-- Дата: 2025-11-14
-- Назначение: Автоматическая обработка событий с ошибками

-- =====================================================
-- 1. Функция для повторной обработки событий с ошибками
-- =====================================================

CREATE OR REPLACE FUNCTION retry_failed_events()
RETURNS TABLE(
  retried_count INTEGER,
  success_count INTEGER,
  error_count INTEGER
) AS $$
DECLARE
  event_record RECORD;
  branch_code TEXT;
  ext_id_value TEXT;
  event_type_value TEXT;
  success_count INTEGER := 0;
  error_count INTEGER := 0;
  retried_count INTEGER := 0;
BEGIN
  -- Обрабатываем события с ошибками (только те, которые можно исправить)
  FOR event_record IN
    SELECT id, company_id, rentprog_id, ext_id, payload, metadata, event_name, type, reason
    FROM events
    WHERE processed = true AND ok = false
      AND (
        reason LIKE '%toISOString%' OR
        reason LIKE '%uuid%'
      )
    ORDER BY ts ASC
    LIMIT 100
  LOOP
    retried_count := retried_count + 1;
    
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
      CONTINUE;
    END IF;
    
    -- Определяем тип события
    event_type_value := COALESCE(event_record.event_name, event_record.type, 'unknown');
    
    -- Отправляем уведомление для повторной обработки
    PERFORM pg_notify(
      'rentprog_event_retry',
      event_record.id::TEXT || '|' || 
      branch_code || '|' || 
      event_type_value || '|' || 
      ext_id_value
    );
    
    -- Сбрасываем статус для повторной обработки
    UPDATE events 
    SET processed = false, ok = NULL, reason = NULL
    WHERE id = event_record.id;
    
    success_count := success_count + 1;
  END LOOP;
  
  RETURN QUERY SELECT retried_count, success_count, error_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION retry_failed_events() IS 
  'Повторная обработка событий с ошибками toISOString и uuid';

-- =====================================================
-- 2. Функция для нормализации payload перед обработкой
-- =====================================================

CREATE OR REPLACE FUNCTION normalize_event_payload(payload JSONB)
RETURNS JSONB AS $$
DECLARE
  normalized JSONB := '{}'::jsonb;
  key TEXT;
  value JSONB;
  array_value JSONB;
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
      IF jsonb_array_length(array_value) > 0 THEN
        normalized := normalized || jsonb_build_object(key, array_value->(jsonb_array_length(array_value) - 1));
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
-- 3. Обновление триггера для нормализации payload
-- =====================================================

CREATE OR REPLACE FUNCTION auto_process_event_trigger()
RETURNS TRIGGER AS $$
DECLARE
  branch_code TEXT;
  ext_id_value TEXT;
  event_type_value TEXT;
  normalized_payload JSONB;
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

COMMENT ON FUNCTION auto_process_event_trigger() IS 
  'Триггер для автоматической обработки событий с нормализацией payload';

