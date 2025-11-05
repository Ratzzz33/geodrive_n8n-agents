-- Миграция: Таблица для дедупликации и логирования обработки событий из UI
-- Дата: 2025-11-05
-- Описание: Хранит хеши обработанных событий и результаты обработки

-- 1. Создать таблицу
CREATE TABLE IF NOT EXISTS event_processing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Идентификация события
  hash TEXT UNIQUE NOT NULL,                 -- SHA256(branch + ts + description)
  event_data JSONB NOT NULL,                 -- Полные данные события
  event_type TEXT,                           -- 'cash_operation', 'maintenance', 'booking_status', 'mileage'
  
  -- Обработка
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  processing_result JSONB,                   -- Результат обработки (success/error)
  
  -- Метаданные
  branch TEXT,
  actor TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_event_log_hash 
  ON event_processing_log(hash);

CREATE INDEX IF NOT EXISTS idx_event_log_type 
  ON event_processing_log(event_type);

CREATE INDEX IF NOT EXISTS idx_event_log_processed 
  ON event_processing_log(processed_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_log_branch 
  ON event_processing_log(branch);

CREATE INDEX IF NOT EXISTS idx_event_log_actor 
  ON event_processing_log(actor);

-- GIN индекс для поиска по JSONB
CREATE INDEX IF NOT EXISTS idx_event_log_data_gin 
  ON event_processing_log USING GIN (event_data);

CREATE INDEX IF NOT EXISTS idx_event_log_result_gin 
  ON event_processing_log USING GIN (processing_result);

-- 3. Комментарии для документации
COMMENT ON TABLE event_processing_log IS 'Лог обработки событий из RentProg UI для дедупликации';
COMMENT ON COLUMN event_processing_log.hash IS 'SHA256 хеш для дедупликации (branch + timestamp + description)';
COMMENT ON COLUMN event_processing_log.event_data IS 'Полные данные события из UI';
COMMENT ON COLUMN event_processing_log.event_type IS 'Тип события: cash_operation, maintenance, booking_status, mileage';
COMMENT ON COLUMN event_processing_log.processing_result IS 'Результат обработки: {success: true/false, error: string, updates: {...}}';

-- 4. Функция автоочистки старых записей (старше 30 дней)
CREATE OR REPLACE FUNCTION cleanup_old_event_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM event_processing_log
  WHERE processed_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_event_logs IS 'Удаляет записи старше 30 дней из event_processing_log';

-- Можно настроить pg_cron для автоматической очистки:
-- SELECT cron.schedule('cleanup-event-logs', '0 2 * * *', 'SELECT cleanup_old_event_logs()');

