# Настройка отладки вебхуков RentProg

## Проблема

Вебхуки от RentProg на адрес `https://n8n.rentflow.rentals/webhook/service-center-webhook` работают нестабильно - иногда приходят в n8n workflow processor service, иногда нет.

## Что было сделано

### 1. Добавлен расширенный формат логов nginx

Создан файл `/workspace/nginx/log-format.conf` с детальным форматом логирования:
- Время запроса и ответа
- Статусы upstream
- Request ID для трейсинга
- Тело запроса (для POST)
- Адрес upstream сервера

### 2. Обновлена конфигурация nginx

Файл `/workspace/nginx/n8n.rentflow.rentals.conf`:
- Добавлен отдельный `location /webhook/` блок
- Настроено детальное логирование в `/var/log/nginx/webhook-debug.log`
- Включен debug уровень для error_log
- Увеличены таймауты для вебхуков

### 3. Создан скрипт анализа логов

Скрипт `/workspace/scripts/analyze-webhook-logs.sh` для:
- Просмотра последних запросов
- Статистики HTTP статусов
- Поиска ошибок и медленных запросов
- Мониторинга в реальном времени
- Специальной проверки `service-center-webhook`

## Инструкция по применению

### Шаг 1: Добавьте формат логов в основной nginx.conf

На сервере добавьте в блок `http {}` файла `/etc/nginx/nginx.conf`:

```nginx
http {
    # ... существующие настройки ...
    
    # Включаем формат логов для вебхуков
    include /path/to/workspace/nginx/log-format.conf;
    
    # ... остальные настройки ...
}
```

Или скопируйте содержимое из `/workspace/nginx/log-format.conf` в `nginx.conf`.

### Шаг 2: Замените конфигурацию n8n.rentflow.rentals

```bash
# На сервере
sudo cp /path/to/workspace/nginx/n8n.rentflow.rentals.conf /etc/nginx/sites-available/n8n.rentflow.rentals
sudo ln -sf /etc/nginx/sites-available/n8n.rentflow.rentals /etc/nginx/sites-enabled/
```

### Шаг 3: Проверьте конфигурацию nginx

```bash
sudo nginx -t
```

Если есть ошибки - исправьте их.

### Шаг 4: Перезапустите nginx

```bash
sudo systemctl reload nginx
# или
sudo systemctl restart nginx
```

### Шаг 5: Проверьте создание файлов логов

```bash
# Проверьте, что файлы созданы
ls -lh /var/log/nginx/webhook-debug*

# Если нет - создайте вручную
sudo touch /var/log/nginx/webhook-debug.log
sudo touch /var/log/nginx/webhook-debug-error.log
sudo chown www-data:www-data /var/log/nginx/webhook-debug*.log
sudo chmod 644 /var/log/nginx/webhook-debug*.log
```

### Шаг 6: Установите скрипт анализа

```bash
# Скопируйте скрипт
sudo cp /path/to/workspace/scripts/analyze-webhook-logs.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/analyze-webhook-logs.sh

# Или создайте алиас
echo "alias webhook-logs='sudo /path/to/workspace/scripts/analyze-webhook-logs.sh'" >> ~/.bashrc
source ~/.bashrc
```

## Использование

### Базовые команды

```bash
# Полный отчет
sudo /usr/local/bin/analyze-webhook-logs.sh

# Последние 50 запросов
sudo /usr/local/bin/analyze-webhook-logs.sh --recent 50

# Статистика HTTP статусов
sudo /usr/local/bin/analyze-webhook-logs.sh --statuses

# Только ошибки
sudo /usr/local/bin/analyze-webhook-logs.sh --errors

# Медленные запросы
sudo /usr/local/bin/analyze-webhook-logs.sh --slow

# Проверка service-center-webhook
sudo /usr/local/bin/analyze-webhook-logs.sh --service-center

# Мониторинг в реальном времени
sudo /usr/local/bin/analyze-webhook-logs.sh --monitor
```

### Мониторинг вебхуков от RentProg

```bash
# Проверьте, приходят ли вебхуки
sudo tail -f /var/log/nginx/webhook-debug.log | grep service-center-webhook

# Или используйте скрипт
sudo /usr/local/bin/analyze-webhook-logs.sh --monitor
```

## Что проверить дальше

### 1. Проверьте активность workflow в n8n

Зайдите в n8n UI (`https://n8n.rentflow.rentals`) и проверьте:
- Есть ли активный workflow с webhook `service-center-webhook`
- Включен ли workflow (Active = true)
- Нет ли ошибок в workflow

### 2. Проверьте URL вебхука в RentProg

Убедитесь, что в настройках RentProg указан правильный URL:
- `https://n8n.rentflow.rentals/webhook/service-center-webhook` (если workflow слушает на `/webhook/service-center-webhook`)
- Или используйте отдельный домен: `https://webhook.rentflow.rentals/` (с обновлением конфига)

### 3. Проверьте rate limiting

Если вебхуки блокируются из-за rate limit (429 ошибка), проверьте:

```bash
sudo /usr/local/bin/analyze-webhook-logs.sh --errors | grep 429
```

Если много 429 ошибок - нужно увеличить rate limit в конфиге.

### 4. Проверьте работу n8n

```bash
# Проверьте статус контейнера n8n
docker ps | grep n8n

# Проверьте логи n8n
docker logs n8n --tail 100 --follow
```

## Возможные причины проблем

1. **Workflow не активен в n8n** - самая частая причина
2. **Неправильный URL** - RentProg отправляет на другой путь
3. **Rate limiting** - слишком много запросов блокируется nginx
4. **Таймауты** - n8n не успевает ответить (но теперь увеличены)
5. **Память n8n** - контейнер перезагружается из-за нехватки памяти
6. **Проблемы с SSL** - проверьте сертификаты

## Следующие шаги

После применения изменений:

1. Подождите следующего вебхука от RentProg
2. Проверьте логи: `sudo /usr/local/bin/analyze-webhook-logs.sh --service-center`
3. Если вебхук НЕ дошел до nginx - проблема на стороне RentProg или сети
4. Если вебхук дошел до nginx, но НЕ обработан n8n - проверьте n8n workflow
5. Если вебхук дошел и обработан успешно - ищите паттерн в проблемных запросах

## Полезные команды

```bash
# Количество вебхуков за последний час
sudo grep "service-center-webhook" /var/log/nginx/webhook-debug.log | grep "$(date -d '1 hour ago' '+%d/%b/%Y:%H')" | wc -l

# Найти все ошибки для service-center-webhook
sudo grep "service-center-webhook" /var/log/nginx/webhook-debug.log | grep -E " (4[0-9]{2}|5[0-9]{2}) "

# Среднее время ответа
sudo grep "service-center-webhook" /var/log/nginx/webhook-debug.log | grep -oP 'rt=\K[0-9.]+' | awk '{sum+=$1; count++} END {print "Avg:", sum/count, "sec"}'
```

## Контакты

Если проблема не решается:
1. Соберите логи: `sudo /usr/local/bin/analyze-webhook-logs.sh --full > webhook-debug-report.txt`
2. Соберите логи n8n: `docker logs n8n --tail 500 > n8n-logs.txt`
3. Проверьте конфигурацию RentProg (URL вебхука, параметры отправки)
