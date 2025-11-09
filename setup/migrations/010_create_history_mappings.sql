-- =====================================================
-- История операций RentProg: таблица маппингов
-- =====================================================
-- Дата: 2025-01-17
-- Описание: Таблица для маппинга типов операций из history
--           на стратегии обработки и целевые таблицы

-- 1. Таблица маппингов типов операций
CREATE TABLE IF NOT EXISTS history_operation_mappings (
  id BIGSERIAL PRIMARY KEY,
  
  -- Тип операции из history
  operation_type TEXT NOT NULL UNIQUE,
  
  -- Сопоставление с вебхуками
  matched_event_type TEXT,  -- соответствующий events.event_name (если есть)
  is_webhook_event BOOLEAN DEFAULT FALSE,
  
  -- Обработка
  target_table TEXT,  -- 'payments', 'cars', 'bookings', 'clients', 'employees', 'skip'
  processing_strategy TEXT,  -- 'extract_payment', 'update_car_status', 'update_employee_cash', 'add_maintenance_note', 'skip'
  
  -- Извлечение данных (jsonpath или правила)
  field_mappings JSONB,  -- как извлекать поля из raw_data
  
  -- Метаданные обработки
  priority INTEGER DEFAULT 0,  -- приоритет: 100 (skip), 90 (критичные), 70 (обычные), 50 (низкие)
  enabled BOOLEAN DEFAULT TRUE,
  notes TEXT,
  
  -- Статистика
  total_processed INTEGER DEFAULT 0,
  last_processed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_history_mappings_priority ON history_operation_mappings(priority DESC) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_history_mappings_webhook ON history_operation_mappings(is_webhook_event) WHERE is_webhook_event = TRUE;
CREATE INDEX IF NOT EXISTS idx_history_mappings_target ON history_operation_mappings(target_table) WHERE enabled = TRUE;

-- Комментарии
COMMENT ON TABLE history_operation_mappings IS 'Маппинг типов операций из history на стратегии обработки';
COMMENT ON COLUMN history_operation_mappings.operation_type IS 'Тип операции из history.operation_type';
COMMENT ON COLUMN history_operation_mappings.is_webhook_event IS 'TRUE если это событие обрабатывается через вебхук (пропускаем)';
COMMENT ON COLUMN history_operation_mappings.target_table IS 'Целевая таблица для сохранения данных';
COMMENT ON COLUMN history_operation_mappings.processing_strategy IS 'Стратегия обработки данных';
COMMENT ON COLUMN history_operation_mappings.field_mappings IS 'JSON с правилами извлечения полей из raw_data';
COMMENT ON COLUMN history_operation_mappings.priority IS 'Приоритет обработки: 100=skip, 90=критичные, 70=обычные, 50=низкие';

-- =====================================================
-- 2. Добавление history_log в основные таблицы для аудита
-- =====================================================

-- Добавить history_log в cars
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cars' AND column_name = 'history_log'
  ) THEN
    ALTER TABLE cars ADD COLUMN history_log JSONB DEFAULT '[]'::jsonb;
    CREATE INDEX IF NOT EXISTS idx_cars_history_log ON cars USING GIN (history_log);
    COMMENT ON COLUMN cars.history_log IS 'Журнал изменений из history (техобслуживание, ремонты, перемещения)';
  END IF;
END $$;

-- Добавить history_log в bookings
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'history_log'
  ) THEN
    ALTER TABLE bookings ADD COLUMN history_log JSONB DEFAULT '[]'::jsonb;
    CREATE INDEX IF NOT EXISTS idx_bookings_history_log ON bookings USING GIN (history_log);
    COMMENT ON COLUMN bookings.history_log IS 'Журнал изменений из history (статусы, платежи, события)';
  END IF;
END $$;

-- Добавить history_log в clients
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'history_log'
  ) THEN
    ALTER TABLE clients ADD COLUMN history_log JSONB DEFAULT '[]'::jsonb;
    CREATE INDEX IF NOT EXISTS idx_clients_history_log ON clients USING GIN (history_log);
    COMMENT ON COLUMN clients.history_log IS 'Журнал изменений из history (обновления контактов, документов)';
  END IF;
END $$;

-- Добавить history_log в employees (для кассовых операций)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' AND column_name = 'history_log'
  ) THEN
    ALTER TABLE employees ADD COLUMN history_log JSONB DEFAULT '[]'::jsonb;
    CREATE INDEX IF NOT EXISTS idx_employees_history_log ON employees USING GIN (history_log);
    COMMENT ON COLUMN employees.history_log IS 'Журнал кассовых операций из history (инкассация, переводы)';
  END IF;
END $$;

-- =====================================================
-- 3. Views для мониторинга и анализа
-- =====================================================

-- View: Статистика обработки истории
CREATE OR REPLACE VIEW history_processing_stats AS
SELECT 
  h.operation_type,
  m.target_table,
  m.processing_strategy,
  m.is_webhook_event,
  m.priority,
  m.enabled as mapping_enabled,
  COUNT(*) as total_operations,
  COUNT(*) FILTER (WHERE h.matched = TRUE) as matched_count,
  COUNT(*) FILTER (WHERE h.processed = TRUE) as processed_count,
  COUNT(*) FILTER (WHERE h.matched = FALSE AND h.processed = FALSE) as pending_count,
  MIN(h.created_at) as first_seen,
  MAX(h.created_at) as last_seen,
  m.notes as mapping_notes
FROM history h
LEFT JOIN history_operation_mappings m ON h.operation_type = m.operation_type
GROUP BY h.operation_type, m.target_table, m.processing_strategy, 
         m.is_webhook_event, m.priority, m.enabled, m.notes
ORDER BY pending_count DESC, total_operations DESC;

COMMENT ON VIEW history_processing_stats IS 'Статистика обработки операций из history с маппингами';

-- View: Неизвестные типы операций (для incremental learning)
CREATE OR REPLACE VIEW unknown_operations AS
SELECT 
  h.operation_type,
  h.entity_type,
  COUNT(*) as frequency,
  COUNT(DISTINCT h.branch) as branches_count,
  MIN(h.created_at) as first_seen,
  MAX(h.created_at) as last_seen,
  -- Примеры описаний
  array_agg(DISTINCT h.description) FILTER (WHERE h.description IS NOT NULL) as sample_descriptions,
  -- Доступные поля в raw_data (из первой записи)
  (
    SELECT jsonb_object_keys(raw_data::jsonb)
    FROM history
    WHERE operation_type = h.operation_type
    AND raw_data IS NOT NULL
    LIMIT 1
  ) as available_fields_sample
FROM history h
WHERE h.operation_type NOT IN (
  SELECT operation_type FROM history_operation_mappings
)
GROUP BY h.operation_type, h.entity_type
ORDER BY frequency DESC;

COMMENT ON VIEW unknown_operations IS 'Неизвестные типы операций для создания новых маппингов (incremental learning)';

-- View: Приоритетная очередь обработки
CREATE OR REPLACE VIEW history_processing_queue AS
SELECT 
  h.id,
  h.branch,
  h.operation_type,
  h.entity_type,
  h.entity_id,
  h.description,
  h.created_at,
  m.priority,
  m.processing_strategy,
  m.target_table,
  -- Время ожидания обработки
  EXTRACT(EPOCH FROM (NOW() - h.created_at)) / 60 as wait_time_minutes
FROM history h
INNER JOIN history_operation_mappings m ON h.operation_type = m.operation_type
WHERE h.processed = FALSE
  AND m.enabled = TRUE
  AND m.processing_strategy != 'skip'
ORDER BY 
  m.priority DESC,
  h.created_at ASC
LIMIT 100;

COMMENT ON VIEW history_processing_queue IS 'Приоритетная очередь необработанных операций';

-- =====================================================
-- Успешно создано!
-- =====================================================

-- Проверка
SELECT 
  'history_operation_mappings' as table_name,
  COUNT(*) as rows
FROM history_operation_mappings
UNION ALL
SELECT 
  'unknown_operations (view)' as table_name,
  COUNT(*) as rows
FROM unknown_operations;

