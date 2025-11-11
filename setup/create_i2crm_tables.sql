-- Таблицы для импорта данных из i2crm (CRM система)
-- Структура: сообщения из Telegram и WhatsApp

-- Таблица диалогов (группировка по клиенту + каналу)
CREATE TABLE IF NOT EXISTS i2crm_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Идентификация
  channel TEXT NOT NULL,              -- 'telegram' или 'whatsapp'
  channel_name TEXT,                  -- Название канала в i2crm (GeoDrive, GeoDriveauto, etc)
  client_identifier TEXT NOT NULL,    -- Username (Telegram) или номер телефона (WhatsApp)
  
  -- Метаданные
  first_message_at TIMESTAMPTZ,       -- Первое сообщение в диалоге
  last_message_at TIMESTAMPTZ,        -- Последнее сообщение
  total_messages INT DEFAULT 0,       -- Количество сообщений
  
  -- Направление сообщений
  incoming_count INT DEFAULT 0,       -- Входящих от клиента
  outgoing_count INT DEFAULT 0,       -- Исходящих к клиенту
  
  -- Временные метки
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Уникальность: один диалог = один клиент + один канал
  CONSTRAINT i2crm_conversations_unique UNIQUE (channel, client_identifier)
);

CREATE INDEX IF NOT EXISTS idx_i2crm_conversations_channel ON i2crm_conversations(channel);
CREATE INDEX IF NOT EXISTS idx_i2crm_conversations_client ON i2crm_conversations(client_identifier);
CREATE INDEX IF NOT EXISTS idx_i2crm_conversations_last_message ON i2crm_conversations(last_message_at DESC);


-- Таблица сообщений
CREATE TABLE IF NOT EXISTS i2crm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES i2crm_conversations(id) ON DELETE CASCADE,
  
  -- Идентификация источника
  channel TEXT NOT NULL,              -- 'telegram' или 'whatsapp'
  channel_name TEXT,                  -- Название канала в i2crm
  client_identifier TEXT NOT NULL,    -- Username или телефон
  
  -- Содержимое
  content TEXT,                       -- Текст сообщения
  direction TEXT NOT NULL,            -- 'incoming' или 'outgoing'
  
  -- Временные метки
  sent_at TIMESTAMPTZ NOT NULL,       -- Когда было отправлено (из колонки "Написано")
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Дополнительная информация
  raw_context TEXT,                   -- Оригинальное значение из колонки "Контекст"
  
  -- Индексы для быстрого поиска
  CONSTRAINT i2crm_messages_check_direction CHECK (direction IN ('incoming', 'outgoing'))
);

CREATE INDEX IF NOT EXISTS idx_i2crm_messages_conversation ON i2crm_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_i2crm_messages_sent_at ON i2crm_messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_i2crm_messages_channel ON i2crm_messages(channel);
CREATE INDEX IF NOT EXISTS idx_i2crm_messages_client ON i2crm_messages(client_identifier);

-- Индекс для полнотекстового поиска по содержимому
CREATE INDEX IF NOT EXISTS idx_i2crm_messages_content_search ON i2crm_messages USING gin(to_tsvector('russian', content));


-- Комментарии
COMMENT ON TABLE i2crm_conversations IS 'Диалоги из i2crm (Telegram + WhatsApp)';
COMMENT ON TABLE i2crm_messages IS 'Сообщения из i2crm (495k+ сообщений из выгрузки Excel)';

COMMENT ON COLUMN i2crm_conversations.channel IS 'telegram или whatsapp';
COMMENT ON COLUMN i2crm_conversations.client_identifier IS 'Username для Telegram, номер телефона для WhatsApp';

COMMENT ON COLUMN i2crm_messages.direction IS 'incoming = от клиента, outgoing = к клиенту';
COMMENT ON COLUMN i2crm_messages.raw_context IS 'Оригинальное значение: "Telegram (вх)", "WhatsApp (исх)" и т.д.';

