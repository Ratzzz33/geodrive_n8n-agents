# Руководство по отладке webhook запросов

## Проблема

Webhook адрес `https://n8n.rentflow.rentals/webhook/service-center-webhook` прописан в RentProg, но n8n workflow иногда видит запросы, а иногда нет.

## Внесённые изменения

### 1. Добавлено детальное логирование nginx

Создан специальный формат логирования `webhook_debug`, который записывает:
- IP адрес отправителя
- Время запроса
- HTTP метод и путь
- Статус ответа
- Время обработки запроса (request_time)
- Время подключения к upstream (upstream_connect_time)
- Время получения заголовков (upstream_header_time)
- Время ответа upstream (upstream_response_time)
- **Тело запроса (request_body)** - для анализа данных webhook

### 2. Обновлена конфигурация n8n.rentflow.rentals

**Изменения:**
- ✅ Добавлена поддержка HTTPS (listen 443 ssl)
- ✅ Добавлен редирект HTTP → HTTPS
- ✅ Создан отдельный `location /webhook/` с детальным логированием
- ✅ Логи webhook запросов пишутся в отдельный файл: `/var/log/nginx/n8n-webhook-detailed.log`

**Важно:** Теперь webhook запросы на `https://n8n.rentflow.rentals/webhook/*` будут правильно обрабатываться через HTTPS.

### 3. Улучшена конфигурация webhook.rentflow.rentals

**Изменения:**
- ✅ Добавлен формат `webhook_debug` для детального логирования
- ✅ Увеличен rate limit: с 30 RPS до 100 RPS (для отладки)
- ✅ Увеличен burst: с 10 до 50 запросов
- ✅ Добавлен отдельный лог для rate limiting: `/var/log/nginx/webhook-ratelimit.log`

### 4. Создан скрипт мониторинга в реальном времени

Файл: `monitor-webhooks.sh`

Скрипт мониторит все webhook логи одновременно с цветным выводом.

## Применение изменений

### Шаг 1: Проверить SSL сертификат для n8n.rentflow.rentals

```bash
# Проверить наличие сертификата
sudo ls -la /etc/letsencrypt/live/n8n.rentflow.rentals/

# Если сертификата нет, получить его через certbot:
sudo certbot certonly --nginx -d n8n.rentflow.rentals
```

### Шаг 2: Проверить конфигурацию nginx

```bash
# Тест конфигурации
sudo nginx -t

# Должно быть: "syntax is ok" и "test is successful"
```

### Шаг 3: Перезагрузить nginx

```bash
# Плавная перезагрузка без разрыва соединений
sudo systemctl reload nginx

# Или полный рестарт (если reload не помог)
sudo systemctl restart nginx

# Проверить статус
sudo systemctl status nginx
```

### Шаг 4: Создать лог-файлы (если их нет)

```bash
# Создать файлы логов
sudo touch /var/log/nginx/n8n-webhook-detailed.log
sudo touch /var/log/nginx/webhook-ratelimit.log

# Установить правильные права
sudo chown www-data:adm /var/log/nginx/n8n-webhook-detailed.log
sudo chown www-data:adm /var/log/nginx/webhook-ratelimit.log
sudo chmod 640 /var/log/nginx/n8n-webhook-detailed.log
sudo chmod 640 /var/log/nginx/webhook-ratelimit.log
```

### Шаг 5: Запустить мониторинг

```bash
# Запустить скрипт мониторинга
sudo /workspace/monitor-webhooks.sh

# Или мониторить напрямую через tail
sudo tail -f /var/log/nginx/n8n-webhook-detailed.log
```

## Диагностика проблем

### Проблема 1: Запросы не доходят до nginx

**Симптомы:** В логах nginx нет записей о входящих webhook запросах

**Проверка:**
```bash
# Смотрим все логи
sudo tail -f /var/log/nginx/n8n-webhook-detailed.log
sudo tail -f /var/log/nginx/webhook-access.log
sudo tail -f /var/log/nginx/n8n-redirect.log

# Проверяем, слушает ли nginx на 443 порту
sudo netstat -tlnp | grep :443

# Проверяем firewall
sudo ufw status
```

**Возможные причины:**
- Firewall блокирует порт 443
- DNS не указывает на правильный IP
- RentProg отправляет запросы на другой адрес

### Проблема 2: Rate limiting блокирует запросы

**Симптомы:** В логах статус 429 (Too Many Requests)

**Проверка:**
```bash
# Смотрим лог rate limiting
sudo tail -f /var/log/nginx/webhook-ratelimit.log

# Проверяем количество запросов с одного IP
sudo grep "limiting requests" /var/log/nginx/webhook-error.log | tail -20
```

**Решение:**
- Временно увеличили limit до 100 RPS (уже сделано)
- Если нужно ещё больше, отредактировать `webhook.rentflow.rentals.conf`

### Проблема 3: n8n не видит webhook

**Симптомы:** Запросы доходят до nginx (статус 200), но n8n workflow не срабатывает

**Проверка:**
```bash
# Проверяем, что n8n запущен и слушает на порту 5678
sudo docker ps | grep n8n
sudo netstat -tlnp | grep :5678

# Проверяем логи n8n
sudo docker logs n8n --tail 100 -f

# Проверяем, что путь webhook правильный
curl -X POST http://localhost:5678/webhook/service-center-webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

**Возможные причины:**
- Путь webhook в n8n workflow не совпадает
- Workflow не активирован
- Webhook node в workflow неправильно настроен

### Проблема 4: SSL сертификат отсутствует или истёк

**Симптомы:** Ошибка SSL при попытке подключения

**Проверка:**
```bash
# Проверить сертификат
sudo certbot certificates

# Проверить доступность через curl
curl -I https://n8n.rentflow.rentals/webhook/service-center-webhook
```

**Решение:**
```bash
# Получить/обновить сертификат
sudo certbot renew --nginx
```

## Анализ логов

### Формат лога webhook_debug

```
IP - USER [TIMESTAMP] "METHOD PATH PROTOCOL" STATUS BYTES "REFERER" "USER_AGENT" rt=REQUEST_TIME uct="UPSTREAM_CONNECT_TIME" uht="UPSTREAM_HEADER_TIME" urt="UPSTREAM_RESPONSE_TIME" request_body="BODY"
```

**Пример:**
```
185.123.45.67 - - [04/Nov/2025:12:34:56 +0000] "POST /webhook/service-center-webhook HTTP/1.1" 200 42 "-" "RentProg-Webhook/1.0" rt=0.123 uct="0.001" uht="0.045" urt="0.122" request_body="{"event":"booking.created","data":{...}}"
```

### Ключевые метрики для анализа

- **rt (request_time)** - общее время обработки запроса (должно быть < 1s для webhook)
- **uct (upstream_connect_time)** - время подключения к n8n (должно быть < 0.1s)
- **urt (upstream_response_time)** - время ответа n8n (должно быть < 0.5s)

Если эти значения большие или `-` (прочерк), значит:
- `-` - соединение с upstream не устанавливалось (n8n не отвечает)
- `> 1s` - n8n медленно обрабатывает запросы

## Полезные команды

### Поиск ошибок

```bash
# Найти все ошибки за последний час
sudo grep "$(date -d '1 hour ago' '+%d/%b/%Y:%H')" /var/log/nginx/webhook-error.log

# Найти все 429 (rate limit) ошибки
sudo grep " 429 " /var/log/nginx/webhook-access.log

# Найти все запросы от конкретного IP
sudo grep "185.123.45.67" /var/log/nginx/n8n-webhook-detailed.log

# Найти все webhook запросы за сегодня
sudo grep "$(date '+%d/%b/%Y')" /var/log/nginx/n8n-webhook-detailed.log | grep "/webhook/"
```

### Статистика

```bash
# Количество webhook запросов за сегодня
sudo grep "$(date '+%d/%b/%Y')" /var/log/nginx/n8n-webhook-detailed.log | wc -l

# Группировка по статус кодам
sudo grep "$(date '+%d/%b/%Y')" /var/log/nginx/webhook-access.log | awk '{print $9}' | sort | uniq -c

# Топ IP адресов отправителей
sudo awk '{print $1}' /var/log/nginx/webhook-access.log | sort | uniq -c | sort -rn | head -10
```

## Следующие шаги

1. ✅ Применить изменения nginx конфигурации
2. ✅ Проверить/создать SSL сертификат для n8n.rentflow.rentals
3. ⏳ Запустить мониторинг и дождаться следующего webhook от RentProg
4. ⏳ Проанализировать логи для определения проблемы
5. ⏳ Если проблема в rate limiting - снизить limits
6. ⏳ Если проблема в n8n - проверить workflow и активацию
7. ⏳ Если запросы не доходят - проверить DNS и firewall

## Контакты для помощи

При возникновении проблем:
1. Собрать логи: `sudo tar -czf webhook-debug-$(date +%Y%m%d-%H%M).tar.gz /var/log/nginx/*webhook*.log`
2. Сохранить вывод: `sudo docker logs n8n > n8n-logs-$(date +%Y%m%d-%H%M).txt 2>&1`
3. Предоставить архив и логи для анализа
