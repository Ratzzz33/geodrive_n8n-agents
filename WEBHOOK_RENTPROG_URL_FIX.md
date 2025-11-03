# Исправление URL вебхуков в RentProg

**Дата:** 2025-11-02  
**Проблема:** Реальные вебхуки от RentProg не доходят до n8n

---

## 🔍 Диагностика проблемы

### Проверка 1: URL в RentProg должен быть БЕЗ пути

**❌ Неправильно (с путем):**
```
https://webhook.rentflow.rentals/webhook/rentprog-webhook
```

**✅ Правильно (только домен):**
```
https://webhook.rentflow.rentals
```

### Проверка 2: Архитектура маршрутизации

```
RentProg отправляет → https://webhook.rentflow.rentals/
                        ↓
              Nginx (корень /)
                        ↓
        http://localhost:5678/webhook/rentprog-webhook
                        ↓
              n8n Webhook Node (path: rentprog-webhook)
                        ↓
         Workflow: RentProg Webhooks Monitor
```

---

## ✅ Исправление

### Шаг 1: Проверить URL в RentProg

1. Войдите в админку RentProg для каждого филиала
2. Перейдите в **Настройки** → **Webhooks** (или **Интеграции**)
3. Проверьте URL вебхука для каждого филиала:

**Должно быть:**
```
https://webhook.rentflow.rentals
```

**НЕ должно быть:**
- ❌ `https://webhook.rentflow.rentals/`
- ❌ `https://webhook.rentflow.rentals/webhook/rentprog-webhook`
- ❌ Любой другой путь

### Шаг 2: Проверить Nginx конфигурацию

На сервере (`46.224.17.15`):

```bash
# Проверить конфигурацию
cat /etc/nginx/sites-available/webhook.rentflow.rentals.conf

# Должно быть:
# location / {
#     proxy_pass http://localhost:5678/webhook/rentprog-webhook;
# }
```

### Шаг 3: Проверить логи Nginx

```bash
# Последние запросы
tail -50 /var/log/nginx/webhook-access.log

# Ошибки
tail -50 /var/log/nginx/webhook-error.log
```

### Шаг 4: Проверить, что workflow активен

1. Откройте n8n UI: https://n8n.rentflow.rentals
2. Workflow "RentProg Webhooks Monitor" должен быть **Active** ✅

---

## 🧪 Тестирование

### Тест 1: Отправить тестовый вебхук вручную

```bash
curl -X POST "https://webhook.rentflow.rentals/" \
  -H "Content-Type: application/json" \
  -d '{
    "ts": "2025-11-02T19:00:00Z",
    "branch": "tbilisi",
    "type": "booking.issue.planned",
    "payload": {"id": "test123"},
    "ok": true
  }'
```

**Ожидаемый ответ:**
```json
{"ok": true, "received": true}
```

### Тест 2: Проверить в Telegram

Должно прийти debug сообщение:
```
🔔 DEBUG: Webhook получен от RentProg
```

### Тест 3: Проверить в БД

```sql
SELECT * FROM events 
WHERE ts > NOW() - INTERVAL '5 minutes'
ORDER BY ts DESC LIMIT 5;
```

---

## 📋 Чек-лист исправления

- [ ] В RentProg указан URL: `https://webhook.rentflow.rentals` (без пути)
- [ ] Nginx проксирует `/` на `localhost:5678/webhook/rentprog-webhook`
- [ ] Workflow "RentProg Webhooks Monitor" активен
- [ ] Тестовый вебхук проходит успешно
- [ ] Debug сообщения приходят в Telegram
- [ ] Записи появляются в таблице `events`

---

## 🔧 Если проблема сохраняется

### Проверить DNS

```bash
dig webhook.rentflow.rentals
# Должно указывать на 46.224.17.15
```

### Проверить SSL сертификат

```bash
curl -I https://webhook.rentflow.rentals
# Должен возвращать 200 OK
```

### Проверить доступность n8n изнутри контейнера

```bash
docker exec n8n curl -I http://localhost:5678/webhook/rentprog-webhook
```

---

## 📝 Примечания

1. **Nginx добавляет путь:** При проксировании `location /` на `http://localhost:5678/webhook/rentprog-webhook`, Nginx автоматически добавляет путь `/webhook/rentprog-webhook`

2. **RentProg отправляет на корень:** RentProg должен отправлять запросы на корневой путь `/` домена `webhook.rentflow.rentals`

3. **n8n ожидает путь:** n8n webhook node ожидает путь `/webhook/rentprog-webhook`, который формируется через Nginx proxy

