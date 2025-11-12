# 📊 Система логирования API endpoints - Инструкция

**Дата:** 2025-11-12

---

## 🚀 Быстрый старт

### 1. Применить миграцию

```bash
node setup/apply_api_logging_migration.mjs
```

Или вручную через psql:

```bash
psql $DATABASE_URL -f db/migrations/006_create_api_logging_tables.sql
```

### 2. Перезапустить Jarvis API

```bash
# На сервере
docker compose restart jarvis-api

# Или локально
npm run build
npm start
```

---

## 📋 Использование

### Просмотр всех endpoints

```bash
curl http://localhost:3000/api-stats/endpoints
```

**Ответ:**
```json
{
  "ok": true,
  "endpoints": [
    {
      "id": "uuid",
      "path": "/sync-bookings",
      "method": "POST",
      "status": "active",
      "description": "Auto-discovered",
      "category": null,
      "stats": {
        "totalRequests": 150,
        "errorCount": 2,
        "avgDurationMs": 45000
      }
    }
  ]
}
```

### Просмотр логов запросов

```bash
# Все запросы
curl "http://localhost:3000/api-stats/requests?limit=50"

# Фильтр по пути
curl "http://localhost:3000/api-stats/requests?path=/sync-bookings&limit=20"

# Фильтр по методу
curl "http://localhost:3000/api-stats/requests?method=POST&limit=50"

# Фильтр по статусу
curl "http://localhost:3000/api-stats/requests?statusCode=404&limit=100"

# Фильтр по дате
curl "http://localhost:3000/api-stats/requests?startDate=2025-11-01&endDate=2025-11-12&limit=100"
```

### Сводная статистика

```bash
# Общая статистика
curl http://localhost:3000/api-stats/summary

# Статистика за период
curl "http://localhost:3000/api-stats/summary?startDate=2025-11-01&endDate=2025-11-12"
```

**Ответ:**
```json
{
  "ok": true,
  "summary": {
    "totalRequests": 1250,
    "uniqueEndpoints": 25,
    "errorCount": 15,
    "errorRate": "1.20%",
    "avgDurationMs": 1250,
    "maxDurationMs": 45000,
    "minDurationMs": 5
  },
  "byMethod": [
    { "method": "POST", "count": 800, "avgDurationMs": 2000 },
    { "method": "GET", "count": 450, "avgDurationMs": 150 }
  ],
  "byStatus": [
    { "statusCode": 200, "count": 1235 },
    { "statusCode": 404, "count": 10 },
    { "statusCode": 500, "count": 5 }
  ],
  "topEndpoints": [
    {
      "path": "/sync-bookings",
      "method": "POST",
      "count": 150,
      "avgDurationMs": 45000,
      "errorCount": 2
    }
  ]
}
```

---

## 🔍 SQL запросы для анализа

### Топ-10 самых используемых endpoints

```sql
SELECT 
  path, 
  method, 
  COUNT(*) as requests, 
  AVG(duration_ms) as avg_ms,
  COUNT(CASE WHEN status_code >= 400 THEN 1 END) as errors
FROM api_request_logs
GROUP BY path, method
ORDER BY requests DESC
LIMIT 10;
```

### Endpoints с ошибками

```sql
SELECT 
  path, 
  method, 
  status_code, 
  COUNT(*) as error_count,
  MAX(request_time) as last_error
FROM api_request_logs
WHERE status_code >= 400
GROUP BY path, method, status_code
ORDER BY error_count DESC;
```

### Неиспользуемые endpoints (нет запросов за 30 дней)

```sql
SELECT 
  e.path, 
  e.method, 
  e.status,
  e.created_at
FROM api_endpoints e
LEFT JOIN api_request_logs l ON l.endpoint_id = e.id
  AND l.request_time > now() - INTERVAL '30 days'
WHERE l.id IS NULL
ORDER BY e.path;
```

### Медленные запросы (> 5 секунд)

```sql
SELECT 
  path,
  method,
  status_code,
  duration_ms,
  request_time,
  error_message
FROM api_request_logs
WHERE duration_ms > 5000
ORDER BY duration_ms DESC
LIMIT 50;
```

### Статистика по часам

```sql
SELECT 
  DATE_TRUNC('hour', request_time) as hour,
  COUNT(*) as requests,
  AVG(duration_ms) as avg_duration,
  COUNT(CASE WHEN status_code >= 400 THEN 1 END) as errors
FROM api_request_logs
WHERE request_time > now() - INTERVAL '7 days'
GROUP BY hour
ORDER BY hour DESC;
```

---

## 🛠️ Управление метаданными endpoints

### Обновить статус endpoint

```sql
UPDATE api_endpoints
SET status = 'deprecated', description = 'Используйте /process-event вместо этого'
WHERE path = '/upsert-car' AND method = 'POST';
```

### Добавить описание endpoint

```sql
UPDATE api_endpoints
SET description = 'Полная синхронизация всех бронирований из RentProg',
    category = 'sync'
WHERE path = '/sync-bookings' AND method = 'POST';
```

### Пометить endpoint как отключенный

```sql
UPDATE api_endpoints
SET status = 'disabled', description = 'Endpoint временно отключен'
WHERE path = '/process-history' AND method = 'POST';
```

---

## 📊 Мониторинг

### Проверка работоспособности логирования

```bash
# Сделать тестовый запрос
curl http://localhost:3000/health

# Проверить, что запрос залогирован
curl "http://localhost:3000/api-stats/requests?path=/health&limit=1"
```

### Очистка старых логов (опционально)

```sql
-- Удалить логи старше 90 дней
DELETE FROM api_request_logs
WHERE request_time < now() - INTERVAL '90 days';
```

---

## ⚙️ Настройки

### Отключить логирование для конкретного endpoint

В `src/api/middleware/apiLogger.ts` добавьте путь в список исключений:

```typescript
if (req.path === '/health' || req.path.startsWith('/conversations') || req.path === '/your-endpoint') {
  return next();
}
```

### Изменить размер сохраняемых тел запросов

В middleware можно ограничить размер `request_body` и `response_body`:

```typescript
// Сохранять только первые 1000 символов
const requestBody = req.requestBody 
  ? JSON.stringify(req.requestBody).substring(0, 1000)
  : null;
```

---

## 🎯 Примеры использования

### Найти все 404 ошибки

```bash
curl "http://localhost:3000/api-stats/requests?statusCode=404&limit=100" | jq '.logs[] | {path, method, requestTime}'
```

### Проверить использование устаревшего endpoint

```sql
SELECT COUNT(*) as usage_count, MAX(request_time) as last_used
FROM api_request_logs
WHERE path = '/upsert-car' AND method = 'POST'
  AND request_time > now() - INTERVAL '30 days';
```

### Найти самые медленные endpoints

```bash
curl http://localhost:3000/api-stats/summary | jq '.topEndpoints | sort_by(.avgDurationMs) | reverse | .[0:5]'
```

---

**Готово!** Система автоматически логирует все запросы к API. 🎉

