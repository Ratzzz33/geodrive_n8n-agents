# Исправление проблемы: вебхуки не приходят из-за HTTPS

**Дата:** 2025-11-02  
**Проблема:** Реальные вебхуки от RentProg не доходят до n8n, хотя URL правильный

---

## 🔍 Найденная проблема

В конфигурации Nginx (`nginx/webhook.rentflow.rentals.conf`) указан только HTTP (порт 80):

```nginx
server {
    listen 80;
    listen [::]:80;
    ...
}
```

Но RentProg отправляет вебхуки на **HTTPS** (порт 443): `https://webhook.rentflow.rentals`

**Результат:** Запросы не обрабатываются, так как нет SSL конфигурации!

---

## ✅ Решение: Добавить HTTPS в Nginx

### Шаг 1: Обновить конфигурацию Nginx

На сервере `46.224.17.15` нужно обновить `/etc/nginx/sites-available/webhook.rentflow.rentals.conf`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name webhook.rentflow.rentals;

    # Редирект с HTTP на HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name webhook.rentflow.rentals;

    # SSL сертификаты (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/webhook.rentflow.rentals/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/webhook.rentflow.rentals/privkey.pem;
    
    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Логирование
    access_log /var/log/nginx/webhook-access.log;
    error_log /var/log/nginx/webhook-error.log;

    # Увеличиваем размер тела запроса
    client_max_body_size 10M;

    # Проксирование вебхуков к n8n
    location / {
        proxy_pass http://localhost:5678/webhook/rentprog-webhook;
        proxy_http_version 1.1;
        
        # Передача заголовков
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # Таймауты
        proxy_connect_timeout 10s;
        proxy_send_timeout 10s;
        proxy_read_timeout 30s;
        
        # Отключение буферизации
        proxy_buffering off;
    }
}
```

### Шаг 2: Проверить наличие SSL сертификата

```bash
ssh root@46.224.17.15

# Проверить наличие сертификата
ls -la /etc/letsencrypt/live/webhook.rentflow.rentals/

# Если сертификата нет, получить его
certbot --nginx -d webhook.rentflow.rentals --non-interactive --agree-tos --email admin@rentflow.rentals --redirect
```

### Шаг 3: Применить конфигурацию

```bash
# Проверить конфигурацию
nginx -t

# Перезагрузить nginx
systemctl reload nginx
# или
service nginx reload
```

---

## 🧪 Проверка после исправления

### Тест 1: Проверить HTTPS доступен

```bash
curl -I https://webhook.rentflow.rentals
# Должен вернуть: HTTP/2 200
```

### Тест 2: Отправить тестовый вебхук

```bash
curl -X POST "https://webhook.rentflow.rentals/" \
  -H "Content-Type: application/json" \
  -d '{"ts": "2025-11-02T19:00:00Z", "branch": "tbilisi", "type": "test", "ok": true}'
```

**Ожидаемый ответ:**
```json
{"ok": true, "received": true}
```

### Тест 3: Проверить в Telegram

Должно прийти debug сообщение от ноды "Debug: Webhook Received"

### Тест 4: Проверить логи nginx

```bash
tail -20 /var/log/nginx/webhook-access.log
# Должны видеть POST запросы
```

---

## 📋 Чек-лист исправления

- [ ] Добавлен `listen 443 ssl` в конфигурацию nginx
- [ ] Указаны пути к SSL сертификатам
- [ ] SSL сертификат существует (или получен через certbot)
- [ ] `nginx -t` проходит без ошибок
- [ ] nginx перезагружен
- [ ] HTTPS endpoint доступен (curl возвращает 200)
- [ ] Тестовый вебхук проходит успешно
- [ ] Debug сообщения приходят в Telegram

---

## 🔧 Альтернативное решение (если SSL сертификата нет)

Если сертификат еще не получен, можно временно использовать HTTP, но тогда в RentProg нужно указать HTTP URL:

```
http://webhook.rentflow.rentals
```

**⚠️ ВНИМАНИЕ:** Это небезопасно и не рекомендуется для продакшн!

---

## 📝 Примечания

1. **Let's Encrypt сертификат:** Обычно уже настроен для домена `webhook.rentflow.rentals`, но нужно проверить

2. **Автоматическое обновление:** Certbot обычно настраивает auto-renewal, но стоит проверить:
   ```bash
   certbot certificates
   ```

3. **Firewall:** Убедитесь что порт 443 открыт:
   ```bash
   ufw status | grep 443
   # или
   iptables -L -n | grep 443
   ```

