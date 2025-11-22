-- Добавляем уникальный индекс на поле phone в таблице clients
-- Это необходимо для работы UPSERT (ON CONFLICT) в n8n workflow

-- 1. Проверяем текущие индексы на таблице clients
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'clients';

-- 2. Создаём уникальный индекс на phone (если его еще нет)
-- IMPORTANT: Phone должен быть уникальным идентификатором клиента
CREATE UNIQUE INDEX IF NOT EXISTS clients_phone_unique 
ON clients(phone);

-- 3. Проверяем что индекс создан
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'clients' AND indexname = 'clients_phone_unique';

-- 4. Альтернатива: если нужен constraint (более строгий)
-- ALTER TABLE clients ADD CONSTRAINT clients_phone_key UNIQUE (phone);

-- NOTES:
-- - Если в таблице уже есть дубликаты по phone, сначала нужно их очистить
-- - Можно использовать составной ключ (phone + email), если phone не уникален
-- - Или использовать первичный ключ (id) как matchingColumn в n8n

