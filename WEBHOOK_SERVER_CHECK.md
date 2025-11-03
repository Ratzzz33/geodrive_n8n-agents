# Проверка конфигурации webhook на сервере

**Дата:** 2025-11-02  
**Команды для выполнения на сервере через SSH**

---

## 🔍 Быстрая проверка (выполнить на сервере)

### 1. Подключиться к серверу
```bash
ssh root@46.224.17.15
```

### 2. Проверить конфигурацию Nginx
```bash
# Проверить наличие HTTPS (443) в конфигурации
grep -E "listen|ssl" /etc/nginx/sites-available/webhook.rentflow.rentals.conf
```

**Ожидается:**
```
listen 80;
listen [::]:80;
listen 443 ssl http2;
listen [::]:443 ssl http2;
ssl_certificate /etc/letsencrypt/live/webhook.rentflow.rentals/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/webhook.rentflow.rentals/privkey.pem;
```

**Если HTTPS (443) отсутствует** - это и есть проблема!

### 3. Проверить логи Nginx
```bash
# Последние 20 запросов
tail -20 /var/log/nginx/webhook-access.log

# Последние ошибки
tail -20 /var/log/nginx/webhook-error.log
```

**Что искать:**
- Запросы от RentProg (IP адреса, user-agent: "node-fetch")
- Ошибки 502/503/504 (проблемы с проксированием)
- Ошибки SSL/TLS

---

## 🔧 Полная диагностика (автоматическая)

Скопировать скрипт на сервер и запустить:

```bash
# На вашем компьютере
scp setup/verify_nginx_config.sh root@46.224.17.15:/tmp/

# На сервере
ssh root@46.224.17.15
chmod +x /tmp/verify_nginx_config.sh
bash /tmp/verify_nginx_config.sh
```

Скрипт проверит:
- ✅ Конфигурацию Nginx (HTTP/HTTPS)
- ✅ SSL сертификат (срок действия)
- ✅ Синтаксис конфигурации
- ✅ Статус Nginx
- ✅ Логи (запросы и ошибки)
- ✅ Открытые порты (80, 443)

---

## 📋 Если HTTPS не настроен

### Вариант 1: Обновить конфигурацию из репозитория

```bash
# На вашем компьютере - скопировать обновленный файл
scp nginx/webhook.rentflow.rentals.conf root@46.224.17.15:/tmp/

# На сервере
ssh root@46.224.17.15

# Бэкап текущей конфигурации
cp /etc/nginx/sites-available/webhook.rentflow.rentals.conf /etc/nginx/sites-available/webhook.rentflow.rentals.conf.backup

# Скопировать новую
cp /tmp/webhook.rentflow.rentals.conf /etc/nginx/sites-available/webhook.rentflow.rentals.conf

# Проверить синтаксис
nginx -t

# Если OK, перезагрузить
systemctl reload nginx
```

### Вариант 2: Добавить HTTPS вручную

Отредактировать `/etc/nginx/sites-available/webhook.rentflow.rentals.conf` и добавить секцию для HTTPS (443):

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name webhook.rentflow.rentals;

    ssl_certificate /etc/letsencrypt/live/webhook.rentflow.rentals/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/webhook.rentflow.rentals/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # ... остальная конфигурация (location /, proxy_pass и т.д.)
}
```

---

## ✅ Проверка после исправления

### 1. Проверить доступность HTTPS
```bash
curl -I https://webhook.rentflow.rentals
# Должен вернуть: HTTP/2 200 (или 301/302)
```

### 2. Отправить тестовый вебхук
```bash
curl -X POST "https://webhook.rentflow.rentals/" \
  -H "Content-Type: application/json" \
  -d '{"ts": "2025-11-02T19:00:00Z", "branch": "test", "type": "test", "ok": true}'
```

**Ожидается:**
```json
{"ok": true, "received": true}
```

### 3. Проверить в Telegram
Должно прийти debug сообщение от ноды "Debug: Webhook Received"

### 4. Проверить в n8n
- Открыть https://n8n.rentflow.rentals
- Workflow "RentProg Webhooks Monitor" → Executions
- Должно быть новое успешное execution

### 5. Проверить в БД
```sql
SELECT * FROM events 
WHERE ts > NOW() - INTERVAL '5 minutes'
ORDER BY ts DESC LIMIT 5;
```

---

## 🚨 Если проблема сохраняется

1. **Проверить RentProg:**
   - Действительно ли вебхуки отправляются? (проверить логи RentProg)
   - Правильный ли URL указан? (`https://webhook.rentflow.rentals` без пути)
   - Вебхуки активированы для всех филиалов?

2. **Проверить DNS:**
   ```bash
   dig webhook.rentflow.rentals
   # Должно указывать на 46.224.17.15
   ```

3. **Проверить firewall:**
   ```bash
   ufw status | grep -E "443|80"
   # Порты должны быть открыты
   ```

4. **Мониторинг в реальном времени:**
   ```bash
   # На сервере - смотреть запросы в реальном времени
   tail -f /var/log/nginx/webhook-access.log
   ```

