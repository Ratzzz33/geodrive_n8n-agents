-- Миграция: Создание таблицы event_processing_log
-- Дата: 2025-11-05
-- Назначение: Дедупликация и логирование UI событий из RentProg

-- 1. Создать таблицу
CREATE TABLE IF NOT EXISTS event_processing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Дедупликация
  hash TEXT UNIQUE NOT NULL,
  
  -- Данные события
  event_data JSONB NOT NULL,
  event_type TEXT,
  
  -- Результат обработки
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  processing_result JSONB,
  
  -- Метаданные
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Создать индексы
CREATE INDEX IF NOT EXISTS idx_event_log_hash 
  ON event_processing_log(hash);

CREATE INDEX IF NOT EXISTS idx_event_log_type 
  ON event_processing_log(event_type) 
  WHERE event_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_log_processed 
  ON event_processing_log(processed_at DESC);

-- 3. Создать индекс для быстрого поиска по данным события
CREATE INDEX IF NOT EXISTS idx_event_log_data_gin 
  ON event_processing_log USING GIN (event_data);

-- 4. Добавить комментарии
COMMENT ON TABLE event_processing_log IS 'Лог обработки UI событий из RentProg (дедупликация и аудит)';
COMMENT ON COLUMN event_processing_log.hash IS 'SHA256 от (branch + timestamp + description) для дедупликации';
COMMENT ON COLUMN event_processing_log.event_data IS 'Полные данные спарсенного события (actor, action, entities)';
COMMENT ON COLUMN event_processing_log.event_type IS 'Классифицированный тип: cash_operation, maintenance, mileage, booking_status';
COMMENT ON COLUMN event_processing_log.processing_result IS 'Результат обработки (успех/ошибка, измененные сущности)';

-- 5. Функция автоочистки старых записей (опционально, вызывать через cron)
CREATE OR REPLACE FUNCTION cleanup_old_event_logs(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM event_processing_log 
  WHERE processed_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Deleted % old event logs (older than % days)', deleted_count, days_to_keep;
  
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_event_logs IS 'Удаляет записи event_processing_log старше N дней (по умолчанию 30)';

-- 6. Проверка
DO $$ 
BEGIN
  RAISE NOTICE 'Migration 006 completed: event_processing_log table created';
END $$;

