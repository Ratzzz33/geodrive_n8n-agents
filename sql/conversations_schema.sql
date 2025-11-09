-- ============================================
-- Миграция: Таблицы для чатов и сделок AmoCRM
-- Дата: 2025-11-09
-- Назначение: Хранение истории переписки (Umnico) и сделок (AmoCRM)
-- ============================================

-- 1. Расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector"; -- для будущих embeddings

-- 2. Расширить существующую таблицу clients
-- (phone и name уже должны быть, добавляем telegram_username если нет)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS telegram_username TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_telegram ON clients(telegram_username);
CREATE INDEX IF NOT EXISTS idx_clients_updated ON clients(updated_at DESC);

-- 3. Таблица диалогов (conversations)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Внешние ID
  umnico_conversation_id TEXT UNIQUE,     -- ID диалога в Umnico (например, 61965921)
  amocrm_scope_id TEXT,                   -- scope_id в AmoCRM (если есть)
  
  -- Метаданные
  channel TEXT,                           -- 'whatsapp' | 'telegram' | 'instagram'
  channel_account TEXT,                   -- Номер/аккаунт канала (995599001665)
  status TEXT DEFAULT 'active',          -- 'active' | 'closed' | 'archived'
  assigned_to_user_id INTEGER,           -- ID ответственного сотрудника
  
  -- Временные метки
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Метаданные (JSON)
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_conversations_client ON conversations(client_id);
CREATE INDEX idx_conversations_umnico ON conversations(umnico_conversation_id) WHERE umnico_conversation_id IS NOT NULL;
CREATE INDEX idx_conversations_amocrm ON conversations(amocrm_scope_id) WHERE amocrm_scope_id IS NOT NULL;
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);
CREATE INDEX idx_conversations_last_msg ON conversations(last_message_at DESC);

COMMENT ON TABLE conversations IS 'Диалоги с клиентами из Umnico и AmoCRM';
COMMENT ON COLUMN conversations.umnico_conversation_id IS 'ID диалога в Umnico (61965921)';
COMMENT ON COLUMN conversations.amocrm_scope_id IS 'scope_id диалога в AmoCRM';

-- 4. Таблица сообщений (messages)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Связи
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL, -- если есть связь с бронью
  
  -- Направление и канал
  direction TEXT NOT NULL,                -- 'incoming' | 'outgoing'
  channel TEXT NOT NULL,                  -- 'whatsapp' | 'telegram' | 'amocrm_note'
  
  -- Содержимое
  text TEXT,
  attachments JSONB DEFAULT '[]'::jsonb, -- [{type: 'image', url: '...'}]
  
  -- Временные метки
  sent_at TIMESTAMPTZ NOT NULL,
  read_at TIMESTAMPTZ,
  
  -- Внешние ID
  umnico_message_id TEXT UNIQUE,         -- ID сообщения в Umnico
  amocrm_note_id TEXT,                   -- ID примечания в AmoCRM
  
  -- Метаданные
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Для RAG (добавим позже)
  embedding vector(1024),                -- Для semantic search
  chunk_index INTEGER,                   -- Порядковый номер чанка
  
  CONSTRAINT valid_direction CHECK (direction IN ('incoming', 'outgoing'))
);

CREATE INDEX idx_messages_client ON messages(client_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_booking ON messages(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX idx_messages_sent_at ON messages(sent_at DESC);
CREATE INDEX idx_messages_umnico ON messages(umnico_message_id) WHERE umnico_message_id IS NOT NULL;
CREATE INDEX idx_messages_direction ON messages(direction);
CREATE INDEX idx_messages_channel ON messages(channel);

-- Для semantic search (позже)
-- CREATE INDEX idx_messages_embedding ON messages USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

COMMENT ON TABLE messages IS 'История сообщений из Umnico и примечаний из AmoCRM';
COMMENT ON COLUMN messages.embedding IS 'Vector embedding для semantic search (RAG)';
COMMENT ON COLUMN messages.chunk_index IS 'Порядковый номер чанка для длинных сообщений';

-- 5. Таблица сделок AmoCRM (amocrm_deals)
CREATE TABLE IF NOT EXISTS amocrm_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Связи
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  
  -- AmoCRM данные
  amocrm_deal_id TEXT UNIQUE NOT NULL,   -- ID сделки в AmoCRM
  pipeline_id TEXT NOT NULL,             -- ID воронки (8580102 - Первичка)
  status_id TEXT NOT NULL,               -- ID статуса (142, 143, etc)
  status_label TEXT,                     -- 'successful' | 'unsuccessful' | 'in_progress'
  
  -- Финансы
  price DECIMAL(12, 2),                  -- Сумма сделки
  
  -- Даты
  created_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Custom Fields из AmoCRM
  custom_fields JSONB DEFAULT '{}'::jsonb, -- {rentprog_client_id, rentprog_booking_id, etc}
  
  -- Статистика
  notes_count INTEGER DEFAULT 0,
  tasks_count INTEGER DEFAULT 0,
  
  -- Метаданные
  metadata JSONB DEFAULT '{}'::jsonb,
  
  CONSTRAINT valid_status_label CHECK (status_label IN ('successful', 'unsuccessful', 'in_progress', 'cancelled'))
);

CREATE INDEX idx_deals_client ON amocrm_deals(client_id);
CREATE INDEX idx_deals_conversation ON amocrm_deals(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_deals_amocrm ON amocrm_deals(amocrm_deal_id);
CREATE INDEX idx_deals_pipeline ON amocrm_deals(pipeline_id);
CREATE INDEX idx_deals_status ON amocrm_deals(status_label);
CREATE INDEX idx_deals_closed ON amocrm_deals(closed_at DESC) WHERE closed_at IS NOT NULL;
CREATE INDEX idx_deals_updated ON amocrm_deals(updated_at DESC);

-- GIN индексы для custom_fields поиска
CREATE INDEX idx_deals_custom_fields ON amocrm_deals USING gin(custom_fields);

COMMENT ON TABLE amocrm_deals IS 'Сделки из AmoCRM (успешные/неуспешные для анализа)';
COMMENT ON COLUMN amocrm_deals.status_label IS 'Метка для фильтрации: successful=142, unsuccessful=143';
COMMENT ON COLUMN amocrm_deals.custom_fields IS 'rentprog_client_id, rentprog_booking_id и другие поля';

-- 6. Таблица для контактов AmoCRM (расширенная)
CREATE TABLE IF NOT EXISTS amocrm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  amocrm_contact_id TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  email TEXT,
  
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_amocrm_contacts_client ON amocrm_contacts(client_id);
CREATE INDEX idx_amocrm_contacts_amocrm ON amocrm_contacts(amocrm_contact_id);
CREATE INDEX idx_amocrm_contacts_phone ON amocrm_contacts(phone);

-- 7. Таблица для истории синхронизации (tracking)
CREATE TABLE IF NOT EXISTS sync_state (
  id BIGSERIAL PRIMARY KEY,
  workflow_name TEXT NOT NULL,           -- 'umnico_scraper' | 'amocrm_deals_scraper'
  system TEXT NOT NULL,                  -- 'umnico' | 'amocrm'
  
  last_sync_at TIMESTAMPTZ NOT NULL,
  last_marker TEXT,                      -- Последняя метка (timestamp/cursor)
  status TEXT DEFAULT 'success',         -- 'success' | 'error' | 'running'
  error_message TEXT,
  
  items_processed INTEGER DEFAULT 0,
  items_added INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(workflow_name, system)
);

CREATE INDEX idx_sync_state_workflow ON sync_state(workflow_name);
CREATE INDEX idx_sync_state_last_sync ON sync_state(last_sync_at DESC);

COMMENT ON TABLE sync_state IS 'Состояние синхронизации для incremental updates';

-- 8. Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers для auto-update
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_amocrm_deals_updated_at BEFORE UPDATE ON amocrm_deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_amocrm_contacts_updated_at BEFORE UPDATE ON amocrm_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. Представления для удобных запросов

-- Успешные диалоги (для RAG)
CREATE OR REPLACE VIEW successful_conversations AS
SELECT 
  c.*,
  cl.phone,
  cl.name AS client_name,
  d.amocrm_deal_id,
  d.price AS deal_price,
  d.closed_at AS deal_closed_at
FROM conversations c
JOIN clients cl ON c.client_id = cl.id
LEFT JOIN amocrm_deals d ON c.id = d.conversation_id
WHERE d.status_label = 'successful'
ORDER BY d.closed_at DESC;

COMMENT ON VIEW successful_conversations IS 'Успешные диалоги для обучения RAG';

-- Последние сообщения по диалогам
CREATE OR REPLACE VIEW latest_messages AS
SELECT DISTINCT ON (conversation_id)
  m.*,
  c.channel,
  cl.phone AS client_phone
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
JOIN clients cl ON m.client_id = cl.id
ORDER BY conversation_id, sent_at DESC;

COMMENT ON VIEW latest_messages IS 'Последнее сообщение в каждом диалоге';

-- ============================================
-- Конец миграции
-- ============================================

-- Проверка созданных объектов
SELECT 
  'Tables created:' AS status,
  COUNT(*) AS count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('conversations', 'messages', 'amocrm_deals', 'amocrm_contacts', 'sync_state');

