# Применение изменений логирования вебхуков

## Быстрая инструкция

### 1. Скопировать конфигурацию на сервер

```bash
# На локальной машине (из репозитория)
scp nginx/n8n.rentflow.rentals.conf root@46.224.17.15:/tmp/

# На сервере
ssh root@46.224.17.15
```

### 2. На сервере: создать резервную копию и применить

```bash
# Резервная копия
cp /etc/nginx/sites-available/n8n.rentflow.rentals.conf /etc/nginx/sites-available/n8n.rentflow.rentals.conf.backup.$(date +%Y%m%d_%H%M%S)

# Копировать новую конфигурацию
cp /tmp/n8n.rentflow.rentals.conf /etc/nginx/sites-available/n8n.rentflow.rentals.conf
```

### 3. Проверить конфигурацию

```bash
sudo nginx -t
```

Если есть ошибки, вернуть старую конфигурацию:
```bash
cp /etc/nginx/sites-available/n8n.rentflow.rentals.conf.backup.* /etc/nginx/sites-available/n8n.rentflow.rentals.conf
```

### 4. Проверить SSL сертификаты

```bash
sudo ls -la /etc/letsencrypt/live/n8n.rentflow.rentals/
```

Если сертификатов нет:
```bash
sudo certbot certonly --nginx -d n8n.rentflow.rentals
```

### 5. Перезагрузить Nginx

```bash
sudo systemctl reload nginx
# или
sudo nginx -s reload
```

### 6. Проверить логи

```bash
# В реальном времени
sudo tail -f /var/log/nginx/n8n-webhook-detailed.log | grep service-center-webhook

# Последние записи
sudo tail -20 /var/log/nginx/n8n-webhook-detailed.log | grep service-center-webhook
```

## Что изменилось

1. **Добавлен HTTPS** (443 порт) для `n8n.rentflow.rentals`
2. **Отдельный location для вебхуков** (`/webhook/`) с детальным логированием
3. **Расширенный формат логов** с информацией о времени обработки и заголовках
4. **Отдельные логи для вебхуков**:
   - `/var/log/nginx/n8n-webhook-detailed.log` - все запросы к вебхукам
   - `/var/log/nginx/n8n-webhook-error.log` - ошибки (debug уровень)
5. **Rate limiting** для защиты от перегрузки
6. **Дополнительные заголовки** для диагностики (`X-Original-URI`, `X-Nginx-Webhook`)

## Мониторинг

Используйте скрипт для автоматической проверки:
```bash
./monitor-webhook-logs.sh service-center-webhook
```

## Откат изменений

Если что-то пошло не так:
```bash
# Восстановить из backup
cp /etc/nginx/sites-available/n8n.rentflow.rentals.conf.backup.* /etc/nginx/sites-available/n8n.rentflow.rentals.conf
sudo nginx -t
sudo systemctl reload nginx
```
