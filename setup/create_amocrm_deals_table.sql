-- Создание таблицы amocrm_deals для хранения сделок из AmoCRM
-- ВАЖНО: Для броней источник правды - RentProg, не AmoCRM!
-- Данные из AmoCRM используются только для анализа и связывания клиентов

-- Удаляем таблицу если существует
DROP TABLE IF EXISTS amocrm_deals CASCADE;

CREATE TABLE amocrm_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Связи с нашими сущностями
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  
  -- ID сделки в AmoCRM (уникальный идентификатор)
  amocrm_deal_id TEXT UNIQUE NOT NULL,
  
  -- Основные поля сделки
  pipeline_id INT,
  status_id INT,
  status_label TEXT,
  price NUMERIC,
  
  -- Временные метки
  created_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Все custom fields сделки (для анализа)
  custom_fields JSONB DEFAULT '{}'::jsonb,
  
  -- Количество заметок
  notes_count INT DEFAULT 0,
  
  -- Метаданные (включая связи с RentProg и полные данные сделки)
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_amocrm_deals_client_id ON amocrm_deals(client_id);
CREATE INDEX IF NOT EXISTS idx_amocrm_deals_conversation_id ON amocrm_deals(conversation_id);
CREATE INDEX IF NOT EXISTS idx_amocrm_deals_amocrm_deal_id ON amocrm_deals(amocrm_deal_id);
CREATE INDEX IF NOT EXISTS idx_amocrm_deals_pipeline_status ON amocrm_deals(pipeline_id, status_id);
CREATE INDEX IF NOT EXISTS idx_amocrm_deals_created_at ON amocrm_deals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_amocrm_deals_updated_at ON amocrm_deals(updated_at DESC);

-- GIN индекс для поиска по metadata (включая rentprog_booking_id)
CREATE INDEX IF NOT EXISTS idx_amocrm_deals_metadata_gin ON amocrm_deals USING GIN (metadata);

-- Комментарии
COMMENT ON TABLE amocrm_deals IS 'Сделки из AmoCRM. ВАЖНО: Для броней источник правды - RentProg!';
COMMENT ON COLUMN amocrm_deals.custom_fields IS 'Все custom fields из AmoCRM (для анализа)';
COMMENT ON COLUMN amocrm_deals.metadata IS 'Метаданные: rentprog_booking_id, rentprog_car_id, deal_full_data, contact_custom_fields';

