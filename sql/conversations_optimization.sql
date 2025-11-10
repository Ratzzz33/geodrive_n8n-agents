-- Миграция для оптимизации синхронизации чатов Umnico
-- Добавляет поле last_message_preview для быстрого сравнения изменений

-- Добавить колонку для кеширования последнего сообщения
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS last_message_preview TEXT;

-- Комментарий для документации
COMMENT ON COLUMN conversations.last_message_preview IS 'Кеш текста последнего сообщения для быстрого сравнения при инкрементальной синхронизации';

-- Индекс для быстрой фильтрации активных чатов
-- (без WHERE с NOW() - не immutable функция)
CREATE INDEX IF NOT EXISTS idx_conversations_recent 
ON conversations(last_message_at DESC NULLS LAST);

-- Индекс для поиска по превью (для дедупликации)
CREATE INDEX IF NOT EXISTS idx_conversations_preview 
ON conversations(last_message_preview) 
WHERE last_message_preview IS NOT NULL;

-- Статистика по созданным индексам
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'conversations'
ORDER BY indexname;

