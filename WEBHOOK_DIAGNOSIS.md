# Диагноз проблемы с вебхуками service-center-webhook

## ❌ ОСНОВНАЯ ПРОБЛЕМА НАЙДЕНА

**Вебхуки НЕ РАБОТАЮТ, потому что в n8n нет воркфлоу, который слушает на пути `service-center-webhook`!**

### Что прописано в RentProg:
```
https://n8n.rentflow.rentals/webhook/service-center-webhook
```

### Какие воркфлоу существуют в n8n:

| Воркфлоу | Webhook Path | Статус |
|----------|--------------|--------|
| RentProg Webhooks Monitor | `rentprog-webhook` | ✅ Активен |
| RentProg Upsert Processor | `upsert-processor` | ✅ Активен |
| Sync Progress | `sync-progress` | ✅ Активен |
| Health & Status | - | ✅ Активен (Cron) |

**❌ НЕТ воркфлоу с путем `service-center-webhook`!**

## Почему вебхуки "иногда работают"

На самом деле они **НЕ работают вообще**. Если казалось, что работают - это могли быть:
1. Тестовые запросы вручную к другим endpoint'ам
2. События, приходящие на правильный endpoint `rentprog-webhook`
3. Ошибка наблюдения (путаница между разными воркфлоу)

## Решение

### Вариант 1: Изменить URL в RentProg (РЕКОМЕНДУЕТСЯ)

Измените URL вебхука в настройках RentProg на:

```
https://webhook.rentflow.rentals/
```

Или:

```
https://n8n.rentflow.rentals/webhook/rentprog-webhook
```

**Этот endpoint уже настроен и работает!** Воркфлоу `RentProg Webhooks Monitor` принимает события и обрабатывает их.

### Вариант 2: Создать новый воркфлоу для service-center-webhook

Если URL в RentProg нельзя изменить, нужно создать новый воркфлоу в n8n:

1. Зайти в n8n UI: `https://n8n.rentflow.rentals`
2. Создать новый workflow
3. Добавить Webhook node с путем `service-center-webhook`
4. Настроить обработку как в `RentProg Webhooks Monitor`
5. Активировать workflow

### Вариант 3: Переименовать существующий воркфлоу

1. Зайти в n8n UI
2. Открыть воркфлоу `RentProg Webhooks Monitor`
3. Изменить webhook path с `rentprog-webhook` на `service-center-webhook`
4. Сохранить и активировать

**⚠️ ВНИМАНИЕ:** Если выберете вариант 3, существующие вебхуки на `rentprog-webhook` перестанут работать!

## Что делать прямо сейчас

### Шаг 1: Примените логирование nginx

Следуйте инструкциям из `WEBHOOK_DEBUG_SETUP.md`:

```bash
# На сервере
sudo cp /path/to/workspace/nginx/n8n.rentflow.rentals.conf /etc/nginx/sites-available/
sudo nginx -t
sudo systemctl reload nginx
```

### Шаг 2: Проверьте, какой URL реально используется

Дождитесь следующего вебхука от RentProg и проверьте логи:

```bash
# Посмотрите последние запросы к /webhook/*
sudo tail -f /var/log/nginx/n8n-access.log | grep "/webhook/"
```

Или после настройки детального логирования:

```bash
sudo /usr/local/bin/analyze-webhook-logs.sh --monitor
```

### Шаг 3: Определите правильное решение

После того, как увидите в логах фактический URL запроса:

**Если видите:** `POST /webhook/service-center-webhook`
- Значит, проблема подтверждена - нужен воркфлоу для этого пути (Вариант 2 или 3)

**Если видите:** `POST /webhook/rentprog-webhook`
- Значит, в RentProg прописан другой URL
- Проверьте настройки вебхуков в RentProg

**Если НЕ видите запросов вообще:**
- Проблема на стороне RentProg (не отправляет вебхуки)
- Или проблема с DNS/сетью
- Или неправильный URL

### Шаг 4: Примените решение

#### Для Варианта 1 (изменить URL в RentProg):

1. Зайдите в настройки RentProg (раздел Webhooks/API/Интеграции)
2. Найдите webhook для service center
3. Измените URL на: `https://webhook.rentflow.rentals/`
4. Сохраните изменения
5. Отправьте тестовый webhook

#### Для Варианта 2 (создать новый воркфлоу):

1. Скопируйте воркфлоу `rentprog-webhooks-monitor.json`
2. Измените webhook path на `service-center-webhook`
3. Импортируйте в n8n
4. Активируйте

#### Для Варианта 3 (переименовать путь):

**⚠️ ОПАСНО! Сломает существующие webhook'и!**

Используйте только если уверены, что `rentprog-webhook` не используется.

## Дополнительная диагностика

### Проверка доступности endpoint'ов

```bash
# Проверьте, что n8n отвечает
curl -X POST https://n8n.rentflow.rentals/webhook/rentprog-webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "ping"}'

# Проверьте несуществующий endpoint (должен вернуть 404)
curl -X POST https://n8n.rentflow.rentals/webhook/service-center-webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "ping"}'
```

Ожидаемые результаты:
- `rentprog-webhook` → 200 OK или обработанный ответ
- `service-center-webhook` → 404 Not Found (подтверждение проблемы)

### Проверка активных воркфлоу в n8n

```bash
# Если есть доступ к API n8n
curl -X GET https://n8n.rentflow.rentals/api/v1/workflows \
  -u "admin:YOUR_PASSWORD" \
  | jq '.data[] | {name: .name, active: .active, webhook: .nodes[] | select(.type == "n8n-nodes-base.webhook") | .parameters.path}'
```

## Итоговая рекомендация

**РЕКОМЕНДУЕТСЯ ВАРИАНТ 1:** Изменить URL вебхука в RentProg на `https://webhook.rentflow.rentals/`

Причины:
- ✅ Не требует изменений в n8n
- ✅ Использует уже настроенный и протестированный воркфлоу
- ✅ Использует оптимизированный Nginx reverse proxy
- ✅ Минимальный риск
- ✅ Быстрое решение

Воркфлоу `RentProg Webhooks Monitor` уже:
- ✅ Парсит и валидирует payload
- ✅ Определяет тип события
- ✅ Сохраняет в таблицу `events`
- ✅ Дедуплицирует события
- ✅ Обрабатывает ошибки
- ✅ Отправляет в Jarvis API для дальнейшей обработки

Нет смысла создавать дубликат для другого пути.

## Что НЕ является проблемой

После проверки выяснилось, что это **НЕ** проблемы:
- ❌ Rate limiting (не настроен на n8n.rentflow.rentals)
- ❌ Таймауты nginx (достаточно большие)
- ❌ Память n8n (4GB, оптимизирован)
- ❌ SSL сертификаты (работают)
- ❌ Nginx конфигурация (правильная)

**Единственная проблема:** неправильный webhook path в настройках RentProg.

## Следующие действия

1. ✅ Добавлено детальное логирование nginx
2. ✅ Создан скрипт анализа логов
3. ✅ Определена основная проблема
4. ⏳ Ожидает решения: изменить URL в RentProg или создать воркфлоу
5. ⏳ После изменения: протестировать вебхуки
6. ⏳ Мониторить логи: `sudo /usr/local/bin/analyze-webhook-logs.sh --service-center`
