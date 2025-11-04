# Логирование service-center-webhook

## Описание

Добавлено детальное логирование для вебхука `https://n8n.rentflow.rentals/webhook/service-center-webhook` в конфигурации nginx.

## Что было сделано

1. **Добавлен специальный location блок** для `/webhook/service-center-webhook` с детальным логированием
2. **Создан кастомный формат логов** `service_center_webhook_detailed` с расширенной информацией:
   - IP адрес источника
   - Метод, URI, статус ответа
   - Время обработки запроса
   - Заголовки вебхука (X-Webhook-Id, X-Event-Id, X-Delivery-Id, X-Timestamp, X-Request-Id)
   - Content-Type, Content-Length
   - User-Agent, Referer

3. **Добавлена HTTPS конфигурация** для `n8n.rentflow.rentals`
4. **Отдельные логи** для вебхука:
   - `/var/log/nginx/service-center-webhook-access.log` - access log
   - `/var/log/nginx/service-center-webhook-error.log` - error log (debug уровень)

## Важно: настройка log_format

**ВАЖНО**: `log_format` должен быть определен в блоке `http` основного конфига nginx (обычно `/etc/nginx/nginx.conf`), а не в server блоке.

Если у вас конфигурация nginx собирается из отдельных файлов через `include`, добавьте этот `log_format` в основной конфиг:

```nginx
http {
    # ... другие настройки ...
    
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
    
    # ... include директории с конфигами ...
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
```

## Применение изменений

После добавления `log_format` в основной конфиг и обновления конфигурации:

```bash
# Проверка конфигурации nginx
sudo nginx -t

# Если проверка прошла успешно, перезагрузите nginx
sudo systemctl reload nginx
# или
sudo service nginx reload
```

## Просмотр логов

### Быстрый просмотр

```bash
# Последние 50 запросов
tail -n 50 /var/log/nginx/service-center-webhook-access.log

# Последние 50 ошибок
tail -n 50 /var/log/nginx/service-center-webhook-error.log

# Мониторинг в реальном времени
tail -f /var/log/nginx/service-center-webhook-access.log
tail -f /var/log/nginx/service-center-webhook-error.log
```

### Использование скрипта

Используйте готовый скрипт для удобного просмотра логов:

```bash
./check-service-center-webhook-logs.sh
```

Скрипт предоставляет интерактивное меню с опциями:
- Просмотр последних запросов/ошибок
- Логи за определенный период
- Поиск по IP адресу
- Поиск по статусу ответа
- Статистика по IP адресам и статусам
- Мониторинг в реальном времени

### Анализ логов вручную

```bash
# Поиск запросов с определенным статусом
grep " 404 " /var/log/nginx/service-center-webhook-access.log
grep " 500 " /var/log/nginx/service-center-webhook-access.log

# Поиск по IP адресу
grep "1.2.3.4" /var/log/nginx/service-center-webhook-access.log

# Поиск по webhook_id
grep "webhook_id=\"abc123\"" /var/log/nginx/service-center-webhook-access.log

# Статистика по статусам
awk '{print $9}' /var/log/nginx/service-center-webhook-access.log | sort | uniq -c | sort -rn

# Уникальные IP адреса
awk '{print $1}' /var/log/nginx/service-center-webhook-access.log | sort | uniq -c | sort -rn
```

## Что логируется

### Access log (service_center_webhook_detailed)

Каждая строка содержит:
- `$remote_addr` - IP адрес источника
- `$time_local` - время запроса
- `$request` - полный HTTP запрос (метод, URI, протокол)
- `$status` - HTTP статус ответа
- `$body_bytes_sent` - размер ответа
- `$http_referer` - Referer заголовок
- `$http_user_agent` - User-Agent
- `rt=$request_time` - время обработки запроса
- `uct`, `uht`, `urt` - время подключения/заголовков/ответа от upstream (n8n)
- `request_id`, `webhook_id`, `event_id`, `delivery_id`, `timestamp` - заголовки вебхука
- `content_type`, `content_length` - информация о теле запроса

### Error log (debug уровень)

Логирует:
- Все ошибки проксирования
- Таймауты
- Ошибки подключения к n8n
- Детальную информацию о запросах, вызвавших ошибки

## Диагностика проблем

### Проблема: Вебхук не доходит до n8n

1. Проверьте access log на наличие запросов:
   ```bash
   tail -f /var/log/nginx/service-center-webhook-access.log
   ```

2. Если запросов нет в логе:
   - Проверьте, что запросы доходят до nginx (возможно, проблема на уровне DNS или firewall)
   - Проверьте, что nginx слушает на порту 443 для `n8n.rentflow.rentals`

3. Если запросы есть, но статус 502/503/504:
   - Проверьте error log: `tail -f /var/log/nginx/service-center-webhook-error.log`
   - Проверьте, что n8n запущен и доступен на `localhost:5678`
   - Проверьте таймауты в конфигурации

### Проблема: Вебхук доходит до n8n, но workflow не запускается

1. Проверьте access log на наличие успешных запросов (статус 200):
   ```bash
   grep " 200 " /var/log/nginx/service-center-webhook-access.log | tail -20
   ```

2. Если запросы успешны (200), проблема в n8n workflow:
   - Проверьте логи n8n
   - Проверьте, что workflow активен и правильно настроен
   - Проверьте, что путь вебхука в n8n соответствует `/webhook/service-center-webhook`

3. Проверьте время ответа (`rt=`) - если оно очень большое, возможно, workflow зависает

## Права доступа к логам

Убедитесь, что у пользователя есть права на чтение логов:

```bash
# Добавить пользователя в группу adm (если нужно)
sudo usermod -a -G adm $USER

# Или изменить права на логи (осторожно!)
sudo chmod 644 /var/log/nginx/service-center-webhook-*.log
```

## Ротация логов

Nginx обычно использует logrotate для ротации логов. Убедитесь, что в `/etc/logrotate.d/nginx` или `/etc/logrotate.d/nginx` настроена ротация для новых логов:

```bash
/var/log/nginx/service-center-webhook-*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}
```

## Дополнительные возможности

### Мониторинг в реальном времени

Для мониторинга всех запросов в реальном времени:

```bash
# Только access log
tail -f /var/log/nginx/service-center-webhook-access.log

# Только error log
tail -f /var/log/nginx/service-center-webhook-error.log

# Оба лога одновременно
tail -f /var/log/nginx/service-center-webhook-*.log
```

### Алерты на ошибки

Можно настроить автоматические алерты при ошибках:

```bash
# Создать скрипт для проверки ошибок
#!/bin/bash
ERRORS=$(grep -c " 50[0-9] " /var/log/nginx/service-center-webhook-access.log | tail -1)
if [ "$ERRORS" -gt 0 ]; then
    echo "Обнаружены ошибки в service-center-webhook!"
    # Отправить уведомление (email, Telegram, etc.)
fi
```

## Файлы конфигурации

- `nginx/n8n.rentflow.rentals.conf` - конфигурация nginx для n8n с логированием service-center-webhook
- `check-service-center-webhook-logs.sh` - скрипт для просмотра логов
