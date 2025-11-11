-- Создание таблицы amocrm_webhook_events для хранения событий вебхуков от AmoCRM
-- Аналогично таблице events для RentProg

-- Удаляем таблицу если существует
DROP TABLE IF EXISTS amocrm_webhook_events CASCADE;

CREATE TABLE amocrm_webhook_events (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Тип события (lead.add, contact.update, etc.)
  event_type TEXT NOT NULL,
  
  -- Тип сущности (lead, contact, company, etc.)
  entity_type TEXT NOT NULL,
  
  -- ID сущности в AmoCRM
  amocrm_entity_id TEXT NOT NULL,
  
  -- Хеш события для дедупликации
  event_hash TEXT UNIQUE NOT NULL,
  
  -- Полный payload события (JSONB)
  payload JSONB DEFAULT '{}'::jsonb,
  
  -- ID аккаунта AmoCRM
  account_id INT,
  
  -- Флаг обработки
  processed BOOLEAN DEFAULT FALSE,
  
  -- Метаданные (для расширения в будущем)
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_amocrm_webhook_events_event_type ON amocrm_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_amocrm_webhook_events_entity_type ON amocrm_webhook_events(entity_type);
CREATE INDEX IF NOT EXISTS idx_amocrm_webhook_events_amocrm_entity_id ON amocrm_webhook_events(amocrm_entity_id);
CREATE INDEX IF NOT EXISTS idx_amocrm_webhook_events_processed ON amocrm_webhook_events(processed) WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_amocrm_webhook_events_ts ON amocrm_webhook_events(ts);

-- Комментарии
COMMENT ON TABLE amocrm_webhook_events IS 'События вебхуков от AmoCRM для обработки в реальном времени';
COMMENT ON COLUMN amocrm_webhook_events.event_hash IS 'SHA256 хеш события для дедупликации (UNIQUE constraint)';
COMMENT ON COLUMN amocrm_webhook_events.processed IS 'Флаг обработки события (FALSE = не обработано, TRUE = обработано)';

