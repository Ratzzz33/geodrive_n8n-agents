# Service Center Webhook Setup

## Обзор

Создан специальный n8n workflow для обработки вебхуков от RentProg service-center филиала с расширенным логированием для диагностики проблем.

## Особенности workflow

### 1. Отдельный endpoint
- **URL:** `https://n8n.rentflow.rentals/webhook/service-center-webhook`
- **Метод:** POST
- **Production URL:** `https://n8n.rentflow.rentals`

### 2. Расширенное логирование
- Логирует каждый входящий вебхук с timestamp и request_id
- Сохраняет в таблицу `webhook_log` для анализа
- Console logs для просмотра в n8n execution logs

### 3. Цепочка обработки

```
Service-Center Webhook
  ↓
Log Webhook (консоль + переменные)
  ↓
Save to DB (webhook_log таблица)
  ↓
Forward to Main Processor (rentprog-webhook)
  ↓
Send Response (200 OK)
```

### 4. Обработка ошибок
- При ошибке на любом этапе отправляется алерт в Telegram
- Workflow продолжает работу даже при ошибках
- Всегда возвращает 200 OK для RentProg

## Установка workflow в n8n

### Вариант 1: Через UI (рекомендуется)

1. Открыть n8n UI: `https://n8n.rentflow.rentals`
2. Войти (admin / ваш пароль)
3. Нажать **"+"** → **"Import from File"**
4. Выбрать файл `/workspace/n8n-workflows/service-center-webhook.json`
5. Нажать **"Import"**
6. Активировать workflow (переключатель **"Active"** в правом верхнем углу)

### Вариант 2: Через API

```bash
# Получить пароль n8n
N8N_PASSWORD=$(grep N8N_PASSWORD .env | cut -d= -f2)

# Импортировать workflow
curl -X POST "https://n8n.rentflow.rentals/api/v1/workflows" \
  -u "admin:$N8N_PASSWORD" \
  -H "Content-Type: application/json" \
  -d @/workspace/n8n-workflows/service-center-webhook.json

# Активировать workflow (замените ID на полученный)
WORKFLOW_ID="<полученный_id>"
curl -X PATCH "https://n8n.rentflow.rentals/api/v1/workflows/$WORKFLOW_ID" \
  -u "admin:$N8N_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"active": true}'
```

## Создание таблицы webhook_log

Если таблица `webhook_log` не существует, создайте её:

```sql
CREATE TABLE IF NOT EXISTS webhook_log (
  id SERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  branch TEXT NOT NULL,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  headers JSONB,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_log_ts ON webhook_log(ts DESC);
CREATE INDEX idx_webhook_log_branch ON webhook_log(branch);
CREATE INDEX idx_webhook_log_request_id ON webhook_log(request_id);
CREATE INDEX idx_webhook_log_event ON webhook_log(event);
```

Или через Drizzle ORM (добавить в `src/db/schema.ts`):

```typescript
export const webhookLog = pgTable('webhook_log', {
  id: serial('id').primaryKey(),
  ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
  branch: text('branch').notNull(),
  event: text('event').notNull(),
  payload: jsonb('payload').notNull(),
  headers: jsonb('headers'),
  requestId: text('request_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

## Проверка работы

### 1. Тестовый вебхук

```bash
curl -X POST https://n8n.rentflow.rentals/webhook/service-center-webhook \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: test-$(date +%s)" \
  -d '{
    "event": "test.event",
    "payload": "{\"id\": 123, \"test\": true}",
    "company_id": 11163
  }'
```

Ожидаемый ответ:
```json
{
  "ok": true,
  "requestId": "test-1730736000",
  "timestamp": "2025-11-04T14:00:00.000Z",
  "message": "Service-center webhook received and forwarded"
}
```

### 2. Проверка в n8n UI

1. Открыть workflow "Service Center Webhook Handler"
2. Перейти в **"Executions"**
3. Должна появиться запись с последним выполнением
4. Проверить каждый node на наличие данных

### 3. Проверка в БД

```sql
-- Последние 10 вебхуков от service-center
SELECT 
  ts,
  event,
  request_id,
  payload->>'id' as rentprog_id
FROM webhook_log 
WHERE branch = 'service-center'
ORDER BY ts DESC 
LIMIT 10;
```

### 4. Проверка логов nginx

```bash
# Смотреть логи в реальном времени
sudo tail -f /var/log/nginx/webhook-service-center.log

# Проверить последние записи
./scripts/monitor-webhooks.sh --recent

# Анализ проблем
./scripts/analyze-webhook-issues.sh
```

## Мониторинг

### Telegram алерты

Алерты приходят в чат с ID из переменной `TELEGRAM_ALERT_CHAT_ID` (по умолчанию `-5004140602`).

Типы алертов:
- ⚠️ Ошибка при сохранении в БД
- ⚠️ Ошибка при форвардинге в основной процессор
- 🚨 Критическая ошибка workflow

### Просмотр статистики

```bash
# Общая статистика
./scripts/monitor-webhooks.sh --stats

# Количество вебхуков за сегодня
sudo grep "$(date '+%d/%b/%Y')" /var/log/nginx/webhook-service-center.log | wc -l

# Коды ответов
sudo grep "$(date '+%d/%b/%Y')" /var/log/nginx/webhook-service-center.log | \
  awk '{print $9}' | sort | uniq -c | sort -rn
```

## Настройка в RentProg

В настройках вебхуков для филиала **service-center** (company_id: 11163) укажите:

```
URL: https://n8n.rentflow.rentals/webhook/service-center-webhook
Method: POST
Content-Type: application/json
```

## Troubleshooting

### Проблема: 404 Not Found

**Причина:** Workflow не активен или путь неверный

**Решение:**
1. Проверить активность workflow в n8n UI
2. Проверить путь в Webhook node (должен быть `service-center-webhook`)
3. Перезапустить workflow

### Проблема: Вебхуки не сохраняются в БД

**Причина:** Таблица `webhook_log` не существует или нет прав

**Решение:**
```bash
# Проверить существование таблицы
psql $DATABASE_URL -c "\d webhook_log"

# Создать таблицу если нет
psql $DATABASE_URL < /workspace/migrations/create_webhook_log.sql
```

### Проблема: Forward to Main Processor возвращает 404

**Причина:** Основной workflow "RentProg Webhooks Monitor" не активен

**Решение:**
1. Открыть n8n UI
2. Активировать workflow "RentProg Webhooks Monitor"
3. Проверить тестовым вебхуком

### Проблема: Нет алертов в Telegram

**Причина:** Неверный chat_id или credentials

**Решение:**
1. Проверить переменную `TELEGRAM_ALERT_CHAT_ID` в docker-compose.yml
2. Проверить Telegram credentials в n8n UI → Settings → Credentials
3. Протестировать отправку сообщения вручную

## Полезные запросы

### Статистика по событиям

```sql
SELECT 
  event,
  COUNT(*) as count,
  MIN(ts) as first_seen,
  MAX(ts) as last_seen
FROM webhook_log 
WHERE branch = 'service-center'
  AND ts > NOW() - INTERVAL '24 hours'
GROUP BY event
ORDER BY count DESC;
```

### Поиск по request_id

```sql
SELECT * FROM webhook_log 
WHERE request_id = 'your-request-id'
ORDER BY ts DESC;
```

### Найти дубликаты

```sql
SELECT 
  payload->>'id' as rentprog_id,
  event,
  COUNT(*) as duplicates
FROM webhook_log 
WHERE branch = 'service-center'
  AND ts > NOW() - INTERVAL '1 hour'
GROUP BY payload->>'id', event
HAVING COUNT(*) > 1
ORDER BY duplicates DESC;
```

## Дополнительные материалы

- [WEBHOOK_DIAGNOSTICS.md](../WEBHOOK_DIAGNOSTICS.md) - Общая диагностика вебхуков
- [n8n-workflows/README.md](./README.md) - Описание всех workflows
- Скрипты мониторинга:
  - `scripts/monitor-webhooks.sh` - Мониторинг в реальном времени
  - `scripts/analyze-webhook-issues.sh` - Анализ проблем
  - `scripts/apply-webhook-config.sh` - Применение nginx конфигурации

---

**Создано:** 2025-11-04  
**Автор:** Cursor AI Agent  
**Статус:** ✅ Готово к применению
