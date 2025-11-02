# ✅ Настройка Nginx и SSL завершена

## Установлено и настроено:

1. **Nginx** - версия 1.18.0 (Ubuntu)
2. **Certbot** - версия 1.21.0
3. **Python3-certbot-nginx** - для автоматической настройки SSL

## Конфигурации Nginx:

### 1. n8n.rentflow.rentals
- **Назначение:** UI n8n
- **Конфигурация:** `/etc/nginx/sites-available/n8n.rentflow.rentals.conf`
- **Проксирует:** `http://localhost:5678`
- **SSL:** ✅ Настроен (Let's Encrypt)
- **Срок действия сертификата:** до 2026-01-31 (89 дней)

### 2. webhook.rentflow.rentals
- **Назначение:** Вебхуки RentProg
- **Конфигурация:** `/etc/nginx/sites-available/webhook.rentflow.rentals.conf`
- **Проксирует:** `http://localhost:5678/webhook/rentprog-webhook`
- **SSL:** ✅ Настроен (Let's Encrypt)
- **Срок действия сертификата:** до 2026-01-31 (89 дней)

## Firewall:

Порты открыты:
- ✅ **80/tcp** - HTTP (для редиректов и Certbot)
- ✅ **443/tcp** - HTTPS (для Nginx)
- ✅ **5678/tcp** - n8n (прямой доступ, опционально)

## Доступность:

✅ **HTTPS доступен:**
- `https://n8n.rentflow.rentals` - UI n8n
- `https://webhook.rentflow.rentals` - Вебхуки RentProg

✅ **HTTP редиректит на HTTPS:**
- `http://n8n.rentflow.rentals` → `https://n8n.rentflow.rentals`
- `http://webhook.rentflow.rentals` → `https://webhook.rentflow.rentals`

## Обновление docker-compose.yml:

Необходимо обновить настройки n8n:

```yaml
- N8N_HOST=n8n.rentflow.rentals
- N8N_PROTOCOL=https
- WEBHOOK_URL=https://webhook.rentflow.rentals/
- N8N_WEBHOOK_URL=https://webhook.rentflow.rentals/
```

## Автоматическое обновление сертификатов:

Certbot настроил автоматическое обновление сертификатов через systemd timer:
- **Таймер:** `/lib/systemd/system/certbot.timer`
- **Автоматическое обновление:** каждые 12 часов
- **Проверка истечения:** за 30 дней до истечения

Проверить статус:
```bash
systemctl status certbot.timer
```

## Следующие шаги:

1. ✅ Обновить `docker-compose.yml` с новыми доменами
2. ✅ Перезапустить n8n контейнер
3. ✅ Обновить настройки вебхуков в RentProg:
   - Старый адрес: `https://geodrive.netlify.app/webhook/rentprog-webhook`
   - Новый адрес: `https://webhook.rentflow.rentals/`
4. ✅ Обновить workflow в n8n для использования нового адреса

## Проверка:

```bash
# Проверка Nginx
systemctl status nginx

# Проверка сертификатов
certbot certificates

# Проверка конфигурации Nginx
nginx -t

# Просмотр логов
tail -f /var/log/nginx/n8n-access.log
tail -f /var/log/nginx/webhook-access.log
```

## Проблемы и решения:

### Если сертификат не обновился автоматически:
```bash
certbot renew
systemctl reload nginx
```

### Если нужно добавить домен:
```bash
certbot --nginx -d новый-домен.rentflow.rentals
```

### Если нужно изменить email для уведомлений:
```bash
certbot update_account --email новый-email@rentflow.rentals
```

