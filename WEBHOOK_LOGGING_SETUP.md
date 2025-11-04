# Настройка логирования вебхуков для диагностики

## Проблема
Вебхук `https://n8n.rentflow.rentals/webhook/service-center-webhook` периодически не виден в n8n workflow processor. Требуется диагностика проблемы через логирование на входе.

## Что было сделано

### 1. Обновлена конфигурация Nginx
Файл: `/workspace/nginx/n8n.rentflow.rentals.conf`

**Изменения:**
- Добавлен HTTPS сервер (ранее был только HTTP)
- Добавлен отдельный `location` для вебхуков (`/webhook/`) с детальным логированием
- Создан расширенный формат логирования `n8n_detailed` с информацией о:
  - Времени запроса
  - IP адресе клиента
  - HTTP методе и URL
  - Статусе ответа
  - Времени обработки (request time, upstream time)
  - Заголовках (Host, X-Forwarded-For)
- Отдельные логи для вебхуков:
  - `/var/log/nginx/n8n-webhook-detailed.log` - детальный лог всех вебхуков
  - `/var/log/nginx/n8n-webhook-error.log` - ошибки вебхуков (debug уровень)
- Добавлен rate limiting для защиты от перегрузки
- Добавлены специальные заголовки для идентификации в логах n8n

### 2. Создан скрипт мониторинга
Файл: `/workspace/monitor-webhook-logs.sh`

Скрипт проверяет:
- Статус Nginx и валидность конфигурации
- Статус контейнера n8n
- Доступность вебхука
- Логи Nginx с последними запросами
- Статистику запросов

## Применение изменений

### 1. Проверка конфигурации Nginx
```bash
sudo nginx -t
```

### 2. Перезагрузка Nginx
```bash
sudo systemctl reload nginx
# или
sudo nginx -s reload
```

Если конфигурация не применяется, перезапустите:
```bash
sudo systemctl restart nginx
```

### 3. Проверка SSL сертификатов
Убедитесь, что SSL сертификаты для `n8n.rentflow.rentals` существуют:
```bash
sudo ls -la /etc/letsencrypt/live/n8n.rentflow.rentals/
```

Если сертификатов нет, создайте их:
```bash
sudo certbot certonly --nginx -d n8n.rentflow.rentals
```

## Мониторинг логов

### Просмотр логов в реальном времени
```bash
# Все вебхуки
sudo tail -f /var/log/nginx/n8n-webhook-detailed.log

# Только service-center-webhook
sudo tail -f /var/log/nginx/n8n-webhook-detailed.log | grep service-center-webhook

# Ошибки
sudo tail -f /var/log/nginx/n8n-webhook-error.log

# Логи n8n
docker logs -f n8n | grep service-center-webhook
```

### Использование скрипта мониторинга
```bash
# Мониторинг конкретного вебхука
./monitor-webhook-logs.sh service-center-webhook

# Мониторинг всех вебхуков (по умолчанию)
./monitor-webhook-logs.sh
```

### Анализ логов
```bash
# Количество запросов за последний час
sudo grep -c service-center-webhook /var/log/nginx/n8n-webhook-detailed.log

# Статистика по статусам
sudo grep service-center-webhook /var/log/nginx/n8n-webhook-detailed.log | \
    awk '{print $9}' | sort | uniq -c | sort -rn

# Запросы с ошибками (не 200)
sudo grep service-center-webhook /var/log/nginx/n8n-webhook-detailed.log | \
    awk '$9 != 200 {print}'

# Последние 10 запросов с IP адресами
sudo grep service-center-webhook /var/log/nginx/n8n-webhook-detailed.log | \
    tail -10 | awk '{print $1, $4, $9, $7}'
```

## Что искать в логах

### Проблемы, которые могут блокировать вебхуки:

1. **Rate limiting (429 статус)**
   - Слишком много запросов от одного IP
   - Решение: проверить лимиты в конфигурации

2. **SSL проблемы (443 порт)**
   - Истекший или невалидный сертификат
   - Решение: обновить сертификаты Let's Encrypt

3. **Таймауты (504/502 статус)**
   - n8n не отвечает вовремя
   - Решение: проверить статус контейнера n8n, увеличить таймауты

4. **Ошибки проксирования (502/503)**
   - n8n недоступен на localhost:5678
   - Решение: проверить docker-compose, перезапустить n8n

5. **Неправильный путь (404 статус)**
   - Вебхук не найден в n8n
   - Решение: проверить наличие workflow с вебхуком в n8n

6. **Проблемы с заголовками**
   - Отсутствие необходимых заголовков
   - Решение: проверить передачу заголовков в конфигурации

## Формат логов

Пример записи в логе:
```
46.224.17.15 - - [15/Jan/2025:10:30:45 +0000] "POST /webhook/service-center-webhook HTTP/1.1" 200 1234 
"-" "RentProg-Webhook/1.0" rt=0.123 uct="0.001" uht="0.002" urt="0.120" 
host="n8n.rentflow.rentals" forwarded="46.224.17.15"
```

Расшифровка:
- `46.224.17.15` - IP адрес клиента
- `[15/Jan/2025:10:30:45 +0000]` - время запроса
- `"POST /webhook/service-center-webhook HTTP/1.1"` - метод и URL
- `200` - HTTP статус ответа
- `1234` - размер ответа в байтах
- `rt=0.123` - время обработки запроса (секунды)
- `uct="0.001"` - время подключения к upstream (n8n)
- `uht="0.002"` - время получения заголовков от upstream
- `urt="0.120"` - время получения ответа от upstream
- `host="n8n.rentflow.rentals"` - Host заголовок
- `forwarded="46.224.17.15"` - X-Forwarded-For заголовок

## Следующие шаги

1. Применить изменения конфигурации Nginx
2. Проверить наличие SSL сертификатов
3. Мониторить логи при следующем запросе к вебхуку
4. Анализировать записи в логах для выявления проблемы
5. При необходимости отключить debug уровень логирования после решения проблемы (изменить `error_log` с `debug` на `warn`)

## Отключение детального логирования (после решения проблемы)

Для экономии ресурсов после решения проблемы можно:
1. Изменить уровень логирования с `debug` на `warn`:
   ```nginx
   error_log /var/log/nginx/n8n-webhook-error.log warn;
   ```
2. Удалить отдельный лог вебхуков, если он не нужен:
   ```nginx
   # Закомментировать строку
   # access_log /var/log/nginx/n8n-webhook-detailed.log n8n_detailed;
   ```
