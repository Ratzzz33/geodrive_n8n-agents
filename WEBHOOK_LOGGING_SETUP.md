# Настройка логирования для вебхуков service-center-webhook

## Проблема

Вебхук `https://n8n.rentflow.rentals/webhook/service-center-webhook` из RentProg то работает, то не работает в n8n workflow процессоре. Необходимо понять, что на нашей стороне может блокировать запросы.

## Решение

Добавлено детальное логирование на уровне nginx для всех запросов к вебхукам.

## Изменения

### 1. Обновлена конфигурация nginx (`nginx/n8n.rentflow.rentals.conf`)

**Добавлено:**

- **Расширенный формат логирования** (`webhook_detailed`) который включает:
  - IP адрес клиента
  - Метод и URL запроса
  - Статус ответа
  - Время выполнения запроса (request_time, upstream_connect_time, upstream_response_time)
  - Заголовки от RentProg: `X-Request-ID`, `X-Webhook-ID`, `X-Event-ID`, `X-Delivery-ID`, `X-Timestamp`
  - Content-Type и Content-Length

- **Отдельный location блок для вебхуков** (`location ~ ^/webhook/(.+)$`):
  - Отдельное логирование в `/var/log/nginx/n8n-webhook-access.log`
  - Отдельное логирование ошибок в `/var/log/nginx/n8n-webhook-error.log`
  - Debug логирование в `/var/log/nginx/n8n-webhook-debug.log`
  - Правильная передача всех заголовков от RentProg в n8n
  - Оптимизированные таймауты для вебхуков

- **HTTPS конфигурация** для `n8n.rentflow.rentals`:
  - Добавлен редирект с HTTP на HTTPS
  - Настроены SSL сертификаты

### 2. Создан скрипт для мониторинга логов (`check-webhook-logs.sh`)

Скрипт для быстрой проверки:
- Последние запросы к `service-center-webhook`
- Ошибки вебхуков
- Статистика запросов
- Статус доступности n8n

## Применение изменений

### 1. Добавление формата логирования в основной nginx.conf

**ВАЖНО:** Формат `log_format` должен быть определен в блоке `http` основного файла `nginx.conf`, а не в файле сервера.

Найдите основной файл конфигурации nginx (обычно `/etc/nginx/nginx.conf`) и добавьте в блок `http`:

```nginx
http {
    # ... существующие настройки ...
    
    # Расширенный формат логирования для вебхуков
    log_format webhook_detailed '$remote_addr - $remote_user [$time_local] '
        '"$request" $status $body_bytes_sent '
        '"$http_referer" "$http_user_agent" '
        'rt=$request_time uct="$upstream_connect_time" '
        'uht="$upstream_header_time" urt="$upstream_response_time" '
        'request_id="$http_x_request_id" '
        'webhook_id="$http_x_webhook_id" '
        'event_id="$http_x_event_id" '
        'delivery_id="$http_x_delivery_id" '
        'content_type="$http_content_type" '
        'content_length="$http_content_length"';
    
    # ... остальные настройки ...
}
```

### 2. Проверка конфигурации nginx

```bash
sudo nginx -t
```

### 3. Перезагрузка nginx

```bash
sudo systemctl reload nginx
# или
sudo nginx -s reload
```

### 4. Проверка логов

```bash
# Просмотр всех запросов к service-center-webhook
sudo tail -f /var/log/nginx/n8n-webhook-access.log | grep service-center-webhook

# Просмотр ошибок
sudo tail -f /var/log/nginx/n8n-webhook-error.log

# Использование скрипта мониторинга
./check-webhook-logs.sh
```

## Анализ логов

### Формат лога вебхуков

```
IP - USER [TIMESTAMP] "METHOD /path HTTP/1.1" STATUS BYTES_SENT 
"REFERER" "USER_AGENT" 
rt=REQUEST_TIME uct="UPSTREAM_CONNECT_TIME" 
uht="UPSTREAM_HEADER_TIME" urt="UPSTREAM_RESPONSE_TIME" 
request_id="X-REQUEST-ID" 
webhook_id="X-WEBHOOK-ID" 
event_id="X-EVENT-ID" 
delivery_id="X-DELIVERY-ID" 
content_type="CONTENT-TYPE" 
content_length="CONTENT-LENGTH"
```

### Типичные проблемы и их индикаторы

1. **Вебхук не доходит до n8n**
   - Проверьте `upstream_connect_time` - если очень большое, значит проблема с подключением к n8n
   - Проверьте статус ответа - 502/503 указывают на недоступность n8n

2. **Вебхук доходит, но n8n не обрабатывает**
   - Проверьте статус ответа - 404 означает, что workflow не найден
   - Проверьте `upstream_response_time` - если очень большое, значит workflow завис

3. **Проблемы с заголовками**
   - Проверьте наличие `webhook_id`, `event_id`, `delivery_id` в логах
   - Если заголовки пустые, значит RentProg их не отправляет

4. **Таймауты**
   - Проверьте `request_time` - если больше 30 секунд, значит сработал таймаут
   - Проверьте `upstream_response_time` - время обработки n8n

## Следующие шаги

1. **Применить изменения**: Перезагрузить nginx с новой конфигурацией
2. **Мониторинг**: Следить за логами в течение нескольких часов
3. **Анализ**: Если вебхук снова пропустится, проверить логи на наличие запроса
4. **Проверка workflow**: Убедиться, что workflow `service-center-webhook` активен в n8n

## Примечания

- Логи вебхуков теперь пишутся отдельно от основного access.log для удобства анализа
- Debug логирование можно отключить в production (убрать `error_log ... debug;`)
- Для production рекомендуется настроить ротацию логов для предотвращения переполнения диска
