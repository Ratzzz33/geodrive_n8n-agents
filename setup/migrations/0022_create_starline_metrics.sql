-- Миграция: Создание таблицы метрик Starline GPS Monitor
-- Дата: 2025-11-13
-- Описание: Таблица для хранения метрик производительности обработки устройств

CREATE TABLE IF NOT EXISTS starline_metrics (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_devices INT NOT NULL,
  processed_devices INT NOT NULL,
  failed_devices INT NOT NULL,
  total_duration_ms INT NOT NULL,
  avg_device_duration_ms NUMERIC(10, 2),
  browser_restarts INT DEFAULT 0,
  session_expired_count INT DEFAULT 0,
  proxy_used BOOLEAN DEFAULT FALSE,
  success_rate NUMERIC(5, 2), -- процент успешности
  batch_size INT DEFAULT 1, -- размер батча для параллельной обработки
  parallel_mode BOOLEAN DEFAULT FALSE -- режим обработки (параллельный/последовательный)
);

CREATE INDEX IF NOT EXISTS idx_starline_metrics_timestamp ON starline_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_starline_metrics_success_rate ON starline_metrics(success_rate);
CREATE INDEX IF NOT EXISTS idx_starline_metrics_parallel_mode ON starline_metrics(parallel_mode);

-- Комментарии к таблице и колонкам
COMMENT ON TABLE starline_metrics IS 'Метрики производительности обработки устройств Starline GPS Monitor';
COMMENT ON COLUMN starline_metrics.total_devices IS 'Общее количество устройств для обработки';
COMMENT ON COLUMN starline_metrics.processed_devices IS 'Количество успешно обработанных устройств';
COMMENT ON COLUMN starline_metrics.failed_devices IS 'Количество устройств с ошибками';
COMMENT ON COLUMN starline_metrics.total_duration_ms IS 'Общее время обработки в миллисекундах';
COMMENT ON COLUMN starline_metrics.avg_device_duration_ms IS 'Среднее время обработки одного устройства в миллисекундах';
COMMENT ON COLUMN starline_metrics.browser_restarts IS 'Количество перезапусков браузера';
COMMENT ON COLUMN starline_metrics.session_expired_count IS 'Количество истекших сессий';
COMMENT ON COLUMN starline_metrics.proxy_used IS 'Использовался ли прокси для логина';
COMMENT ON COLUMN starline_metrics.success_rate IS 'Процент успешности обработки (0-100)';
COMMENT ON COLUMN starline_metrics.batch_size IS 'Размер батча для параллельной обработки';
COMMENT ON COLUMN starline_metrics.parallel_mode IS 'Режим обработки: true = параллельный, false = последовательный';

