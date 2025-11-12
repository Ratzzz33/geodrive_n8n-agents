# 📊 Система логирования API - Быстрая инструкция

## ✅ Что сделано

- ✅ Созданы таблицы `api_endpoints` и `api_request_logs`
- ✅ Подключен middleware для автоматического логирования
- ✅ Добавлены API endpoints для просмотра статистики

## 🚀 Использование

### 1. Просмотр всех endpoints

```bash
curl http://localhost:3000/api-stats/endpoints
```

### 2. Просмотр логов запросов

```bash
# Все запросы
curl "http://localhost:3000/api-stats/requests?limit=50"

# Фильтр по пути
curl "http://localhost:3000/api-stats/requests?path=/sync-bookings"

# Фильтр по ошибкам (404, 500 и т.д.)
curl "http://localhost:3000/api-stats/requests?statusCode=404"
```

### 3. Сводная статистика

```bash
curl http://localhost:3000/api-stats/summary
```

## 🔍 Полезные SQL запросы

### Найти неиспользуемые endpoints

```sql
SELECT e.path, e.method, e.status
FROM api_endpoints e
LEFT JOIN api_request_logs l ON l.endpoint_id = e.id
WHERE l.id IS NULL OR l.request_time < now() - INTERVAL '30 days'
ORDER BY e.path;
```

### Топ-10 самых используемых

```sql
SELECT path, method, COUNT(*) as requests, AVG(duration_ms) as avg_ms
FROM api_request_logs
GROUP BY path, method
ORDER BY requests DESC
LIMIT 10;
```

### Endpoints с ошибками

```sql
SELECT path, method, status_code, COUNT(*) as error_count
FROM api_request_logs
WHERE status_code >= 400
GROUP BY path, method, status_code
ORDER BY error_count DESC;
```

## 📝 Управление статусами endpoints

```sql
-- Пометить как deprecated
UPDATE api_endpoints
SET status = 'deprecated', description = 'Используйте /process-event'
WHERE path = '/upsert-car' AND method = 'POST';

-- Добавить описание
UPDATE api_endpoints
SET description = 'Полная синхронизация бронирований', category = 'sync'
WHERE path = '/sync-bookings' AND method = 'POST';
```

## 📚 Полная документация

См. [API_LOGGING_USAGE.md](./API_LOGGING_USAGE.md) для детальной инструкции.

