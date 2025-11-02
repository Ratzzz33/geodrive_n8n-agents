-- Проверка тестового события в БД
SELECT 
    id,
    ts,
    branch,
    type,
    ext_id,
    ok,
    processed,
    reason
FROM events 
WHERE ext_id = 'test_verification_123'
ORDER BY ts DESC 
LIMIT 1;

-- Последние 5 событий для общей проверки
SELECT 
    id,
    ts,
    branch,
    type,
    ext_id,
    ok,
    processed
FROM events 
ORDER BY ts DESC 
LIMIT 5;

