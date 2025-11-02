# Обновление адресов вебхуков RentProg

**Дата обновления:** 2025-01-15  
**Статус:** ✅ Применено

---

## Новые адреса вебхуков

### Продакшн адрес (Production)
```
https://webhook.rentflow.rentals
```

**Использование:**
- Настройка в RentProg для всех филиалов (Tbilisi, Batumi, Kutaisi, Rustavi)
- SSL сертификат: действителен до 2026-01-31
- Проксирование через Nginx на `localhost:5678/webhook/rentprog-webhook`

**Настройка в RentProg:**
1. Войдите в админку RentProg
2. Перейдите в настройки интеграций/вебхуков
3. Для каждого филиала укажите: `https://webhook.rentflow.rentals`

---

### Тестовый адрес (Development/Testing)
```
https://geodrive.netlify.app/webhook/rentprog-webhook
```

**Использование:**
- Для тестирования и разработки
- Проксируется через Netlify Redirects
- Можно использовать для отладки без влияния на продакшн

---

## Архитектура обработки вебхуков

### Продакшн (webhook.rentflow.rentals)
```
RentProg
    ↓
https://webhook.rentflow.rentals
    ↓ (Nginx proxy на сервере 46.224.17.15:443)
http://localhost:5678/webhook/rentprog-webhook
    ↓ (n8n webhook node)
n8n: RentProg Webhooks Monitor workflow
    ↓
PostgreSQL таблица events (с дедупликацией)
    ↓ (cron каждые 5 минут)
n8n: RentProg Upsert Processor workflow
    ↓
Jarvis API /process-event
    ↓
Auto-fetch из RentProg + Upsert в БД
```

### Тестовый (geodrive.netlify.app)
```
Тестовые запросы
    ↓
https://geodrive.netlify.app/webhook/rentprog-webhook
    ↓ (Netlify redirect)
http://46.224.17.15:5678/webhook/rentprog-webhook
    ↓ (n8n webhook node)
Та же обработка через n8n workflows
```

---

## Что изменилось

### До обновления
- Один адрес через Netlify: `https://geodrive.netlify.app/webhook/rentprog-webhook`
- Проксирование через Netlify Redirects

### После обновления
- **Продакшн:** `https://webhook.rentflow.rentals` (прямой домен с SSL)
- **Тест:** `https://geodrive.netlify.app/webhook/rentprog-webhook` (сохранен)
- Nginx на сервере для продакшн трафика
- Лучшая производительность и надежность
- SSL сертификат от Let's Encrypt

---

## Конфигурационные файлы

### 1. Nginx (`/etc/nginx/sites-available/webhook.rentflow.rentals.conf`)
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name webhook.rentflow.rentals;

    location / {
        proxy_pass http://localhost:5678/webhook/rentprog-webhook;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. n8n Webhook Node
```json
{
  "parameters": {
    "httpMethod": "POST",
    "path": "rentprog-webhook",
    "responseMode": "responseNode"
  },
  "type": "n8n-nodes-base.webhook"
}
```

### 3. Docker Compose (переменные окружения)
```yaml
environment:
  - WEBHOOK_URL=https://webhook.rentflow.rentals/
  - N8N_WEBHOOK_URL=https://webhook.rentflow.rentals/
```

### 4. Netlify (`netlify.toml`)
```toml
# Тестовый адрес сохранен
[[redirects]]
  from = "/webhook/rentprog-webhook"
  to = "http://46.224.17.15:5678/webhook/rentprog-webhook"
  status = 200
  force = true
```

---

## Тестирование

### Тест продакшн адреса
```bash
curl -X POST "https://webhook.rentflow.rentals" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "booking.issue.planned",
    "payload": {"id": "test_prod_123"}
  }'
```

**Ожидаемый ответ:**
```json
{"ok": true, "received": true}
```

### Тест тестового адреса
```bash
curl -X POST "https://geodrive.netlify.app/webhook/rentprog-webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "booking.issue.planned",
    "payload": {"id": "test_dev_456"}
  }'
```

**Ожидаемый ответ:**
```json
{"ok": true, "received": true}
```

### Проверка в БД
```sql
-- Проверить, что события сохранились
SELECT * FROM events 
WHERE ext_id IN ('test_prod_123', 'test_dev_456') 
ORDER BY ts DESC;

-- Проверить обработку (через 5 минут)
SELECT id, ts, branch, type, ext_id, processed 
FROM events 
WHERE ext_id IN ('test_prod_123', 'test_dev_456');
```

---

## DNS настройки

### Текущие A-записи (проверено 2025-01-15)
```
webhook.rentflow.rentals → 46.224.17.15 ✓
n8n.rentflow.rentals → 46.224.17.15 ✓
```

**Проверка DNS:**
```bash
nslookup webhook.rentflow.rentals
# Ожидается: 46.224.17.15

dig webhook.rentflow.rentals +short
# Ожидается: 46.224.17.15
```

---

## SSL сертификаты

### webhook.rentflow.rentals
- **Выдан:** Let's Encrypt
- **Действителен до:** 2026-01-31
- **Автопродление:** Настроено через Certbot
- **Проверка:** `https://webhook.rentflow.rentals` (должен возвращать 200 OK)

**Проверка SSL:**
```bash
curl -I https://webhook.rentflow.rentals
# HTTP/2 200 (SSL работает)

openssl s_client -connect webhook.rentflow.rentals:443 -servername webhook.rentflow.rentals
# Показывает информацию о сертификате
```

---

## Инструкции для настройки RentProg

### Шаги для каждого филиала:

1. **Tbilisi (Тбилиси)**
   - Адрес вебхука: `https://webhook.rentflow.rentals`
   - Branch параметр: автоматически определяется по настройкам филиала

2. **Batumi (Батуми)**
   - Адрес вебхука: `https://webhook.rentflow.rentals`
   - Branch параметр: автоматически определяется

3. **Kutaisi (Кутаиси)**
   - Адрес вебхука: `https://webhook.rentflow.rentals`
   - Branch параметр: автоматически определяется

4. **Rustavi (Рустави)**
   - Адрес вебхука: `https://webhook.rentflow.rentals`
   - Branch параметр: автоматически определяется

**Примечание:** Все филиалы используют один общий адрес. Филиал определяется автоматически по настройкам в RentProg или передается в параметрах запроса.

---

## Мониторинг и логи

### Nginx логи
```bash
# Access log (успешные запросы)
tail -f /var/log/nginx/webhook-access.log

# Error log (ошибки)
tail -f /var/log/nginx/webhook-error.log
```

### n8n executions
- URL: http://46.224.17.15:5678/projects/YeYimRJroeGbDN4w/executions
- Workflow: "RentProg Webhooks Monitor"
- Проверять статус выполнений (Success/Error)

### PostgreSQL таблица events
```sql
-- Последние 10 событий
SELECT * FROM events ORDER BY ts DESC LIMIT 10;

-- Статистика по филиалам
SELECT branch, COUNT(*), 
       SUM(CASE WHEN ok THEN 1 ELSE 0 END) as success_count,
       SUM(CASE WHEN processed THEN 1 ELSE 0 END) as processed_count
FROM events
GROUP BY branch;
```

---

## Troubleshooting

### Проблема: Вебхук не доходит до n8n

**Проверка 1: DNS**
```bash
nslookup webhook.rentflow.rentals
# Должен вернуть: 46.224.17.15
```

**Проверка 2: Nginx**
```bash
# На сервере 46.224.17.15
sudo systemctl status nginx
sudo nginx -t
```

**Проверка 3: n8n**
```bash
curl http://localhost:5678/health
# Должен вернуть: OK
```

**Проверка 4: Файрволл**
```bash
sudo ufw status
# Порты 80, 443 должны быть открыты
```

---

### Проблема: SSL ошибка

**Решение:**
```bash
# На сервере 46.224.17.15
sudo certbot renew --force-renewal -d webhook.rentflow.rentals
sudo systemctl reload nginx
```

---

### Проблема: События не обрабатываются (processed = false)

**Проверка:**
```sql
SELECT * FROM events WHERE processed = false ORDER BY ts DESC LIMIT 10;
```

**Решение:**
1. Проверить, что "RentProg Upsert Processor" workflow активен
2. Проверить executions в n8n
3. Проверить, что Jarvis API доступен: `curl http://46.224.17.15:3000/health`

---

## Контакты и документация

- **n8n Console:** http://46.224.17.15:5678
- **Документация:** [N8N_WORKFLOW_IMPORT_GUIDE.md](./docs/N8N_WORKFLOW_IMPORT_GUIDE.md)
- **Миграции БД:** [DATABASE_MIGRATIONS.md](./docs/DATABASE_MIGRATIONS.md)
- **Отчет о настройке:** [SESSION_REPORT_2025-01-15.md](./SESSION_REPORT_2025-01-15.md)

---

## История изменений

### 2025-01-15
- ✅ Создан продакшн адрес `webhook.rentflow.rentals`
- ✅ Настроен Nginx proxy
- ✅ Получен SSL сертификат от Let's Encrypt
- ✅ Тестовый адрес сохранен для разработки
- ✅ Обновлена документация

---

**Статус:** ✅ Готово к использованию  
**Продакшн адрес:** https://webhook.rentflow.rentals  
**Тестовый адрес:** https://geodrive.netlify.app/webhook/rentprog-webhook

