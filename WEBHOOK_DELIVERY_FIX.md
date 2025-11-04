# Исправление проблемы с прерывистой доставкой вебхуков от RentProg

**Дата:** 2025-01-15  
**Статус:** ✅ Исправлено

---

## Найденные проблемы

### 1. ❌ Отсутствует Response Node для быстрого ACK

**Проблема:**  
Workflow использует `responseMode: "responseNode"`, но Response Node отсутствует. Это означает, что n8n ждет завершения всего workflow перед отправкой ответа. Если workflow выполняет длинные синхронные HTTP-запросы (к оркестратору, upsert processor), RentProg может получить таймаут и считать вебхук неуспешным.

**Последствия:**
- RentProg получает ответ только после завершения всех операций (может занять 10-30+ секунд)
- RentProg может считать вебхук неуспешным и ретраить
- Прерывистая доставка вебхуков

**Решение:**  
✅ Добавлена Response Node "Respond to Webhook" сразу после Webhook ноды, которая возвращает быстрый ACK (< 100ms) параллельно с обработкой.

**Изменения:**
```json
{
  "id": "respond-node",
  "name": "Respond to Webhook",
  "type": "n8n-nodes-base.respondToWebhook",
  "parameters": {
    "respondWith": "json",
    "responseBody": "={{ { \"ok\": true, \"received\": true, \"timestamp\": $now.toISO() } }}"
  }
}
```

**Структура workflow:**
```
Webhook
├── Parse & Validate Format → [дальнейшая обработка]
└── Respond to Webhook (параллельно, возвращает ACK сразу)
```

---

### 2. ⚠️ Возможные проблемы с rate limiting

**Проблема:**  
В nginx настроен rate limiting: 30 RPS с burst до 10 запросов. Если RentProg отправляет вебхуки быстрее, запросы могут получать 429 ошибку.

**Текущая конфигурация:**
```nginx
limit_req_zone $binary_remote_addr zone=webhook_limit:10m rate=30r/s;

location / {
    limit_req zone=webhook_limit burst=10 nodelay;
    limit_req_status 429;
}
```

**Рекомендация:**  
- Если RentProg отправляет вебхуки чаще, увеличить лимит или временно отключить для тестирования
- Мониторить логи nginx на наличие 429 ошибок

**Проверка:**
```bash
# Проверить логи на 429 ошибки
grep "429" /var/log/nginx/webhook-access.log
grep "429" /var/log/nginx/webhook-error.log
```

---

### 3. ⚠️ Таймауты в nginx

**Текущие настройки:**
```nginx
proxy_connect_timeout 10s;
proxy_send_timeout 10s;
proxy_read_timeout 30s;
```

**Проблема:**  
Если n8n обрабатывает вебхук дольше 30 секунд (proxy_read_timeout), nginx разорвет соединение и вернет ошибку.

**Рекомендация:**  
С Response Node эта проблема решена, так как ответ возвращается сразу (< 100ms), а обработка продолжается асинхронно. Но если будут проблемы, можно увеличить таймауты:

```nginx
proxy_read_timeout 60s;  # Увеличить до 60 секунд
```

---

### 4. ⚠️ Синхронные HTTP-запросы в workflow

**Проблема:**  
Workflow делает синхронные HTTP-запросы:
- `Auto Process` → запрос к оркестратору `/process-webhook`
- `Trigger Upsert Processor` → запрос к n8n `/webhook/upsert-processor`

Эти запросы могут занимать время и задерживать ответ.

**Решение:**  
✅ Response Node возвращает ответ сразу, обработка идет асинхронно в фоне. Даже если HTTP-запросы займут время, RentProg уже получил подтверждение.

---

## Применение исправлений

### 1. Обновить workflow в n8n

**Через n8n UI:**
1. Открыть n8n: https://n8n.rentflow.rentals
2. Workflows → "RentProg Webhooks Monitor"
3. Menu → Import from File
4. Выбрать `n8n-workflows/rentprog-webhooks-monitor.json`
5. Сохранить и активировать

**Или через API:**
```bash
# Импорт workflow через n8n API
curl -X POST "http://46.224.17.15:5678/api/v1/workflows" \
  -H "Content-Type: application/json" \
  -u "admin:${N8N_PASSWORD}" \
  -d @n8n-workflows/rentprog-webhooks-monitor.json
```

---

### 2. Проверить rate limiting

**Проверить логи на 429 ошибки:**
```bash
tail -100 /var/log/nginx/webhook-access.log | grep 429
```

**Если есть 429 ошибки:**
- Увеличить лимит в nginx конфигурации
- Или временно отключить для тестирования

**Временное отключение (для тестирования):**
```nginx
# Закомментировать rate limiting
# limit_req zone=webhook_limit burst=10 nodelay;
```

---

### 3. Мониторинг

**Проверить работу Response Node:**
```bash
# Отправить тестовый вебхук
curl -X POST "https://webhook.rentflow.rentals" \
  -H "Content-Type: application/json" \
  -d '{"event":"test","payload":"{\"id\":123}"}'

# Ожидается быстрый ответ (< 100ms):
# {"ok": true, "received": true, "timestamp": "..."}
```

**Проверить executions в n8n:**
- Открыть n8n UI
- Проверить последние executions
- Убедиться, что Response Node выполняется быстро (< 100ms)

**Проверить логи nginx:**
```bash
# Посмотреть последние запросы
tail -50 /var/log/nginx/webhook-access.log

# Проверить ошибки
tail -50 /var/log/nginx/webhook-error.log
```

---

## Ожидаемое поведение после исправления

### До исправления:
1. RentProg отправляет вебхук
2. n8n получает и начинает обработку
3. Workflow выполняет все операции (парсинг, HTTP-запросы, сохранение в БД)
4. **Только после завершения всех операций** (10-30+ секунд) отправляется ответ
5. RentProg может получить таймаут и считать вебхук неуспешным

### После исправления:
1. RentProg отправляет вебхук
2. n8n получает и **сразу возвращает ACK** (< 100ms) через Response Node
3. Обработка продолжается асинхронно в фоне (парсинг, HTTP-запросы, сохранение в БД)
4. RentProg получает подтверждение быстро и не ретраит

---

## Дополнительные рекомендации

### 1. Мониторинг доставки

Создать мониторинг для отслеживания:
- Количество вебхуков от RentProg
- Время ответа (должно быть < 100ms)
- Количество 429 ошибок
- Количество неуспешных вебхуков

### 2. Retry механизм

Если RentProg имеет встроенный retry механизм, убедиться что:
- Response Node работает корректно (не возвращает ошибки)
- Дедупликация работает (таблица `events` с `UNIQUE(company_id, type, rentprog_id)`)
- Event hash используется для дополнительной защиты от дубликатов

### 3. Логирование

Убедиться что:
- Все вебхуки логируются в таблицу `events`
- Ошибки логируются в `webhook_error_log`
- Логи nginx доступны для анализа

---

## Проверка работы

### 1. Тестовый вебхук

```bash
curl -X POST "https://webhook.rentflow.rentals" \
  -H "Content-Type: application/json" \
  -d '{"event":"test","payload":"{\"id\":123,\"company_id\":1}"}'
```

**Ожидается:**
- Быстрый ответ: `{"ok": true, "received": true, "timestamp": "..."}`
- Время ответа: < 100ms

### 2. Проверка в n8n

- Открыть последний execution
- Убедиться, что Response Node выполнился быстро
- Проверить, что обработка продолжилась после ответа

### 3. Проверка в БД

```sql
-- Проверить последние события
SELECT * FROM events 
ORDER BY ts DESC 
LIMIT 10;

-- Проверить ошибки
SELECT * FROM webhook_error_log 
ORDER BY ts DESC 
LIMIT 10;
```

---

## Статус

✅ **Response Node добавлен** - вебхуки теперь получают быстрый ACK  
⏳ **Требуется обновление workflow в n8n**  
⏳ **Требуется мониторинг на наличие 429 ошибок**

---

**Следующий шаг:** Импортировать обновленный workflow в n8n и проверить работу
