# Быстрая настройка логирования service-center-webhook

## Шаг 1: Добавить log_format в основной конфиг nginx

Откройте `/etc/nginx/nginx.conf` и добавьте в блок `http`:

```nginx
http {
    # ... существующие настройки ...
    
    # Формат для детального логирования service-center-webhook
    log_format service_center_webhook_detailed '$remote_addr - $remote_user [$time_local] '
        '"$request" $status $body_bytes_sent '
        '"$http_referer" "$http_user_agent" '
        'rt=$request_time uct="$upstream_connect_time" '
        'uht="$upstream_header_time" urt="$upstream_response_time" '
        'request_id="$http_x_request_id" '
        'webhook_id="$http_x_webhook_id" '
        'event_id="$http_x_event_id" '
        'delivery_id="$http_x_delivery_id" '
        'timestamp="$http_x_timestamp" '
        'content_type="$http_content_type" '
        'content_length="$http_content_length"';
}
```

## Шаг 2: Проверить и применить конфигурацию

```bash
# Проверить конфигурацию
sudo nginx -t

# Если OK, перезагрузить nginx
sudo systemctl reload nginx
```

## Шаг 3: Проверить логи

```bash
# Проверить, что логи создаются
tail -f /var/log/nginx/service-center-webhook-access.log

# Или использовать скрипт
./check-service-center-webhook-logs.sh
```

## Готово!

Теперь все запросы к `https://n8n.rentflow.rentals/webhook/service-center-webhook` будут детально логироваться.

Подробная документация: `SERVICE_CENTER_WEBHOOK_LOGGING.md`
