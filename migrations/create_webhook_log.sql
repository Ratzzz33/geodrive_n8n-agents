-- Миграция: Создание таблицы webhook_log для диагностики вебхуков
-- Дата: 2025-11-04
-- Описание: Таблица для логирования всех входящих вебхуков с расширенной информацией

CREATE TABLE IF NOT EXISTS webhook_log (
  id SERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  branch TEXT NOT NULL,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  headers JSONB,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_webhook_log_ts ON webhook_log(ts DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_log_branch ON webhook_log(branch);
CREATE INDEX IF NOT EXISTS idx_webhook_log_request_id ON webhook_log(request_id);
CREATE INDEX IF NOT EXISTS idx_webhook_log_event ON webhook_log(event);

-- Комментарии к таблице и колонкам
COMMENT ON TABLE webhook_log IS 'Лог всех входящих вебхуков от RentProg для диагностики';
COMMENT ON COLUMN webhook_log.id IS 'Уникальный идентификатор записи';
COMMENT ON COLUMN webhook_log.ts IS 'Timestamp получения вебхука';
COMMENT ON COLUMN webhook_log.branch IS 'Филиал (tbilisi, batumi, kutaisi, service-center)';
COMMENT ON COLUMN webhook_log.event IS 'Тип события (car.update, booking.create, etc.)';
COMMENT ON COLUMN webhook_log.payload IS 'Полный payload вебхука в JSON формате';
COMMENT ON COLUMN webhook_log.headers IS 'HTTP заголовки запроса';
COMMENT ON COLUMN webhook_log.request_id IS 'Уникальный ID запроса для трассировки';
COMMENT ON COLUMN webhook_log.created_at IS 'Дата создания записи';
