# Диагностика проблем с вебхуками RentProg

## Проблема

Вебхуки от RentProg к `https://n8n.rentflow.rentals/webhook/service-center-webhook` иногда доходят, иногда нет.

## Решение

### 1. Обновленная конфигурация Nginx

Добавлено детальное логирование для диагностики:

```nginx
# Детальный формат логирования
log_format webhook_detailed '$remote_addr - $remote_user [$time_local] '
                            '"$request" $status $body_bytes_sent '
                            '"$http_referer" "$http_user_agent" '
                            'request_time=$request_time '
                            'upstream_time=$upstream_response_time '
                            'upstream_status=$upstream_status '
                            'request_id=$request_id '
                            'request_body=$request_body '
                            'content_type=$content_type '
                            'content_length=$content_length';
```

### 2. Отдельный endpoint для service-center

Создан отдельный location с индивидуальным логированием:

```nginx
location /webhook/service-center-webhook {
    access_log /var/log/nginx/webhook-service-center.log webhook_detailed;
    error_log /var/log/nginx/webhook-service-center-error.log debug;
    proxy_pass http://localhost:5678/webhook/service-center-webhook;
}
```

### 3. Лог-файлы

После обновления конфигурации доступны следующие логи:

- `/var/log/nginx/webhook-access.log` - все вебхуки с детальной информацией
- `/var/log/nginx/webhook-service-center.log` - только service-center вебхуки
- `/var/log/nginx/webhook-service-center-error.log` - ошибки service-center (debug уровень)
- `/var/log/nginx/webhook-error.log` - общие ошибки

## Применение изменений

### Шаг 1: Скопировать обновленную конфигурацию

```bash
sudo cp /workspace/nginx/webhook.rentflow.rentals.conf /etc/nginx/sites-available/
```

### Шаг 2: Проверить конфигурацию

```bash
sudo nginx -t
```

### Шаг 3: Перезагрузить Nginx

```bash
sudo systemctl reload nginx
```

### Шаг 4: Проверить создание лог-файлов

```bash
sudo ls -la /var/log/nginx/webhook-*
```

## Скрипты мониторинга

### Мониторинг в реальном времени

```bash
# Следить за service-center вебхуками
./scripts/monitor-webhooks.sh service-center

# Следить за всеми вебхуками
./scripts/monitor-webhooks.sh all

# Показать последние 10 записей
./scripts/monitor-webhooks.sh --recent

# Показать статистику
./scripts/monitor-webhooks.sh --stats
```

### Анализ проблем

```bash
# Полный анализ проблем с вебхуками
./scripts/analyze-webhook-issues.sh
```

Скрипт проверяет:
- ✅ Rate limiting блокировки (429 ошибки)
- ✅ Таймауты и проблемы с upstream
- ✅ 5xx ошибки от n8n
- ✅ 404 ошибки (неверные пути)
- ✅ Статистика service-center вебхуков
- ✅ Доступность n8n
- ✅ Временные паттерны нагрузки

## Типичные проблемы и решения

### Проблема 1: Rate Limiting (429)

**Симптомы:**
- В логах появляются записи с кодом 429
- Вебхуки теряются при высокой нагрузке

**Решение:**
```nginx
# В конфигурации увеличить лимит:
limit_req_zone $binary_remote_addr zone=webhook_limit:10m rate=50r/s;
limit_req zone=webhook_limit burst=20 nodelay;
```

### Проблема 2: n8n не отвечает

**Симптомы:**
- В error.log появляются ошибки "Connection refused" или "Gateway timeout"
- Статус upstream показывает ошибки

**Решение:**
```bash
# Проверить статус n8n
docker ps | grep n8n

# Проверить логи n8n
docker logs n8n --tail 100

# Перезапустить n8n
docker restart n8n
```

### Проблема 3: Workflow не активен

**Симптомы:**
- Nginx успешно проксирует запросы (200 OK)
- Но события не обрабатываются в n8n

**Решение:**
1. Открыть n8n UI: `https://n8n.rentflow.rentals`
2. Найти workflow для service-center-webhook
3. Убедиться, что workflow активен (переключатель Active)
4. Проверить настройки Webhook node:
   - Path должен быть: `service-center-webhook`
   - HTTP Method: POST

### Проблема 4: Неверный URL в RentProg

**Симптомы:**
- В логах 404 ошибки
- Requests не доходят до правильного endpoint

**Проверка:**
```bash
# Посмотреть какие пути запрашиваются
sudo grep " 404 " /var/log/nginx/webhook-access.log | awk '{print $7}' | sort | uniq
```

**Решение:**
В настройках RentProg для филиала service-center должен быть указан URL:
```
https://n8n.rentflow.rentals/webhook/service-center-webhook
```

## Проверка после применения изменений

### 1. Отправить тестовый вебхук

```bash
curl -X POST https://n8n.rentflow.rentals/webhook/service-center-webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true, "event": "test.event"}'
```

### 2. Проверить появление в логах

```bash
# Должны увидеть запрос в service-center логе
sudo tail -f /var/log/nginx/webhook-service-center.log
```

### 3. Проверить обработку в n8n

Открыть n8n UI → Executions → проверить наличие последнего выполнения

## Мониторинг

### Быстрая проверка статуса

```bash
# Последние 10 вебхуков service-center
sudo tail -n 10 /var/log/nginx/webhook-service-center.log

# Количество успешных запросов за последний час
sudo grep "$(date '+%d/%b/%Y:%H')" /var/log/nginx/webhook-service-center.log | \
  grep " 200 " | wc -l

# Количество ошибок за последний час
sudo grep "$(date '+%d/%b/%Y:%H')" /var/log/nginx/webhook-service-center.log | \
  grep -v " 200 " | wc -l
```

### Настройка алертов (опционально)

Можно настроить мониторинг через:
- Healthchecks.io для пинга доступности
- Sentry для алертов при ошибках
- Grafana + Loki для визуализации логов

## Дополнительная информация

### Структура логирования

```
webhook-access.log          # Все вебхуки (детальный формат)
├── webhook-service-center.log   # Только service-center
└── webhook-error.log        # Ошибки nginx

Каждая запись содержит:
- IP адрес клиента
- Timestamp
- HTTP метод и путь
- Статус ответа
- Время обработки
- Статус upstream (n8n)
- Request ID для трассировки
```

### Request ID

Каждый запрос получает уникальный `X-Request-ID` для трассировки через все компоненты:
- Nginx логи
- n8n логи
- Postgres логи
- Jarvis API логи

Можно использовать для поиска конкретного запроса:

```bash
# Найти все записи по request_id
REQUEST_ID="abc123"
sudo grep "$REQUEST_ID" /var/log/nginx/webhook-*.log
docker logs n8n 2>&1 | grep "$REQUEST_ID"
```

## Следующие шаги

После применения изменений и мониторинга в течение нескольких часов:

1. ✅ Проверить, что все вебхуки успешно доходят
2. ✅ Убедиться в отсутствии rate limiting блокировок
3. ✅ Проверить время обработки (должно быть < 1 сек)
4. ✅ При необходимости оптимизировать n8n workflows

---

**Автор:** Cursor AI Agent  
**Дата:** 2025-11-04  
**Статус:** ✅ Готово к применению
