# Улучшения обработки вебхуков - 2025-01-15

## Обзор

Применены 4 улучшения из анализа параллельной системы (`WEBHOOK_ARCHITECTURE_ANALYSIS.md`):

1. ✅ **Rate Limiting на уровне Nginx** - защита от перегрузки
2. ✅ **Гарантированный 200 OK даже при ошибках** - Fast ACK паттерн
3. ✅ **Event Hash для улучшенной дедупликации** - SHA256 hash от headers + payload
4. ✅ **Подробное логирование ошибок** - таблица `webhook_error_log` для анализа

---

## 1. Rate Limiting на уровне Nginx

### Изменения

**Файл:** `nginx/webhook.rentflow.rentals.conf`

```nginx
# Rate limiting зона для вебхуков (30 запросов в секунду на IP)
limit_req_zone $binary_remote_addr zone=webhook_limit:10m rate=30r/s;

location / {
    # Rate limiting для защиты от перегрузки (30 RPS, burst до 10 запросов)
    limit_req zone=webhook_limit burst=10 nodelay;
    limit_req_status 429;
    ...
}
```

### Преимущества

- Защита от DDoS и перегрузки сервера
- Не влияет на логику n8n workflow
- Простая настройка и отключение

### Применение

```bash
# На сервере
sudo nginx -t  # Проверка конфигурации
sudo systemctl reload nginx  # Перезагрузка без простоя
```

---

## 2. Гарантированный 200 OK даже при ошибках

### Текущая реализация

В workflow уже есть нода **"Respond (Fast Ack)"**, которая:
- Подключена параллельно с "Parse & Validate Format" сразу после "Webhook"
- Всегда возвращает `{"ok": true, "received": true}` в течение < 100ms
- Срабатывает даже если дальнейшая обработка завершится с ошибкой

### Преимущества

- RentProg получает подтверждение быстро (< 100ms)
- Не происходит повторных отправок вебхуков
- Обработка продолжается асинхронно в фоне

### Проверка

Fast ACK работает автоматически, так как нода подключена параллельно к Webhook.

---

## 3. Event Hash для улучшенной дедупликации

### Изменения в БД

**Миграция:** `setup/migrate_add_event_hash_and_error_log.mjs`

```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_events_hash ON events(event_hash) WHERE event_hash IS NOT NULL;
```

### Изменения в workflow

**Нода:** "Parse & Validate Format"

- Генерация `event_hash` через SHA256 от headers + payload
- Формула: `SHA256(JSON.stringify({x-webhook-id, x-event-id, x-delivery-id, timestamp, payload}))`
- Fallback на payload + event + timestamp если headers отсутствуют
- Сохранение `event_hash` в таблицу `events`

### Преимущества

- Дополнительная защита от дубликатов (кроме уникального constraint)
- Можно использовать для поиска похожих событий
- Помогает отлаживать проблемы с повторными доставками

### Использование

```sql
-- Поиск дубликатов по hash
SELECT event_hash, COUNT(*) 
FROM events 
WHERE event_hash IS NOT NULL 
GROUP BY event_hash 
HAVING COUNT(*) > 1;
```

---

## 4. Подробное логирование ошибок

### Изменения в БД

**Таблица:** `webhook_error_log`

```sql
CREATE TABLE webhook_error_log (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  phase TEXT NOT NULL,        -- 'sync', 'parse', 'worker', 'save', 'upsert', 'validation'
  kind TEXT NOT NULL,         -- 'error', 'warn', 'info'
  error TEXT,
  payload JSONB,
  meta JSONB,
  request_id TEXT,
  event_hash TEXT,
  company_id INTEGER,
  event_type TEXT,
  rentprog_id TEXT
);
```

**Индексы:**
- `idx_webhook_error_log_ts` - для быстрого поиска по времени
- `idx_webhook_error_log_phase` - для фильтрации по этапу
- `idx_webhook_error_log_kind` - для фильтрации по типу ошибки
- `idx_webhook_error_log_event_hash` - для связи с событиями

### Изменения в workflow

**Новая нода:** "Log Error to DB"

- Подключена после всех error paths:
  - "Alert: Parse Error" → "Log Error to DB"
  - "Auto Process" (error) → "Log Error to DB"
  - "Trigger Upsert Processor" (error) → "Log Error to DB"
  - "Save Event" (error) → "Log Error to DB"

### Поля

- **phase**: Этап обработки (`parse`, `sync`, `validation`, `save`, `unknown`)
- **kind**: Тип ошибки (`error` - критическая, `warn` - предупреждение, `info` - информация)
- **error**: Текст ошибки
- **payload**: Полный payload вебхука (JSONB)
- **meta**: Метаданные (validationErrors, errorStack, rawEvent)
- **request_id**: ID запроса для трейсинга
- **event_hash**: Hash события для связи с `events`
- **company_id**, **event_type**, **rentprog_id**: Контекст события

### Использование

```sql
-- Все ошибки за последний час
SELECT phase, kind, error, ts
FROM webhook_error_log
WHERE ts > NOW() - INTERVAL '1 hour'
ORDER BY ts DESC;

-- Критические ошибки парсинга
SELECT * FROM webhook_error_log
WHERE phase = 'parse' AND kind = 'error'
ORDER BY ts DESC
LIMIT 20;

-- Ошибки для конкретного события
SELECT * FROM webhook_error_log
WHERE event_hash = 'abc123...'
ORDER BY ts DESC;
```

---

## Применение изменений

### 1. Миграция БД

```bash
node setup/migrate_add_event_hash_and_error_log.mjs
```

### 2. Обновление Nginx

```bash
# На сервере
cd /root/geodrive_n8n-agents
git pull
sudo cp nginx/webhook.rentflow.rentals.conf /etc/nginx/sites-available/webhook.rentflow.rentals.conf
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Обновление workflow в n8n

Workflow уже обновлен в файле `n8n-workflows/rentprog-webhooks-monitor.json`.

**Импорт через n8n UI:**
1. Открыть n8n: https://n8n.rentflow.rentals
2. Workflows → "RentProg Webhooks Monitor"
3. Menu → Import from File
4. Выбрать `n8n-workflows/rentprog-webhooks-monitor.json`
5. Сохранить и активировать

---

## Проверка работы

### 1. Rate Limiting

```bash
# Отправка 35 запросов подряд (должно вернуть 429 после 30)
for i in {1..35}; do
  curl -X POST https://webhook.rentflow.rentals/webhook/rentprog-webhook \
    -H "Content-Type: application/json" \
    -d '{"event":"test","payload":"{}"}' &
done
```

### 2. Event Hash

```sql
-- Проверка что event_hash заполняется
SELECT id, ts, event_hash, type, rentprog_id
FROM events
WHERE event_hash IS NOT NULL
ORDER BY ts DESC
LIMIT 10;
```

### 3. Логирование ошибок

```sql
-- Проверка что ошибки логируются
SELECT phase, kind, error, ts
FROM webhook_error_log
ORDER BY ts DESC
LIMIT 10;
```

---

## Обратная совместимость

✅ **Все изменения обратно совместимы:**
- `event_hash` - nullable, не ломает существующие запросы
- `webhook_error_log` - новая таблица, не влияет на существующие
- Rate limiting - только ограничивает запросы, не меняет логику
- Fast ACK - уже работал, просто подтвержден

---

## Следующие шаги

1. ✅ Применить миграцию БД
2. ✅ Обновить Nginx конфигурацию на сервере
3. ✅ Импортировать обновленный workflow в n8n
4. ✅ Мониторить логи ошибок в `webhook_error_log`
5. ⏳ Рассмотреть автоматический retry для Dead Letter Queue (будущее)

---

**Дата:** 2025-01-15  
**Статус:** ✅ Готово к применению

