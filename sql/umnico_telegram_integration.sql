-- ============================================
-- Миграция: Telegram интеграция для Umnico диалогов
-- Дата: 2025-11-09
-- Назначение: Добавление полей для связи диалогов Umnico с Telegram темами
-- ============================================

-- 1. Добавить поля в таблицу conversations для Telegram интеграции
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS tg_chat_id BIGINT,
ADD COLUMN IF NOT EXISTS tg_topic_id INTEGER,
ADD COLUMN IF NOT EXISTS client_name TEXT,
ADD COLUMN IF NOT EXISTS car_info TEXT,
ADD COLUMN IF NOT EXISTS booking_dates TEXT,
ADD COLUMN IF NOT EXISTS session_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS assigned_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;

-- 2. Комментарии к новым полям
COMMENT ON COLUMN conversations.tg_chat_id IS 'ID Telegram чата (группы/форума) где создана тема';
COMMENT ON COLUMN conversations.tg_topic_id IS 'ID темы в Telegram форуме (message_thread_id)';
COMMENT ON COLUMN conversations.client_name IS 'Имя клиента для названия темы в Telegram';
COMMENT ON COLUMN conversations.car_info IS 'Информация об автомобиле для названия темы';
COMMENT ON COLUMN conversations.booking_dates IS 'Даты бронирования для названия темы (формат: 12.11-15.11)';
COMMENT ON COLUMN conversations.session_expires_at IS 'Время истечения сессии ожидания ответа клиента (1 час после последнего сообщения)';
COMMENT ON COLUMN conversations.assigned_employee_id IS 'Ответственный сотрудник (связь с employees.id), если есть активная бронь';

-- 3. Индексы для быстрого поиска активных сессий
-- Примечание: Используем частичный индекс без NOW() в условии, так как NOW() не IMMUTABLE
CREATE INDEX IF NOT EXISTS idx_conversations_active_sessions 
ON conversations(session_expires_at, status) 
WHERE session_expires_at IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_conversations_tg_topic 
ON conversations(tg_chat_id, tg_topic_id) 
WHERE tg_topic_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_assigned_employee 
ON conversations(assigned_employee_id) 
WHERE assigned_employee_id IS NOT NULL;

-- 4. Проверка созданных объектов
SELECT 
  'Migration completed' AS status,
  COUNT(*) FILTER (WHERE column_name IN ('tg_chat_id', 'tg_topic_id', 'client_name', 'car_info', 'booking_dates', 'session_expires_at', 'assigned_employee_id')) AS columns_added
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'conversations';

