-- Удаление дубликатов из i2crm_messages, оставляя только первую запись каждой группы

-- Создаем временную таблицу с уникальными ID (минимальный ID для каждой группы дубликатов)
CREATE TEMP TABLE unique_message_ids AS
SELECT MIN(id) as id
FROM i2crm_messages
GROUP BY 
    channel,
    client_identifier,
    sent_at,
    substring(content, 1, 100);

-- Удаляем все записи, которых нет в списке уникальных
DELETE FROM i2crm_messages
WHERE id NOT IN (SELECT id FROM unique_message_ids);

-- Статистика после удаления
SELECT 
    'After cleanup' as status,
    COUNT(*) as total_messages,
    COUNT(DISTINCT (channel, client_identifier, sent_at, substring(content,1,100))) as unique_messages
FROM i2crm_messages;

