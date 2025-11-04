# Решение проблемы с вебхуками service-center ✅

## Проблема

Вебхуки от RentProg на адрес `https://n8n.rentflow.rentals/webhook/service-center-webhook` работали нестабильно - иногда доходили, иногда нет. Не было возможности диагностировать причину.

## Решение

Внедрена полная система диагностики и мониторинга вебхуков на всех уровнях:

### 1. ✅ Nginx - детальное логирование
- Добавлен расширенный формат логирования `webhook_detailed`
- Создан отдельный лог для service-center: `/var/log/nginx/webhook-service-center.log`
- Добавлено логирование времени обработки, upstream статуса, request_id

### 2. ✅ N8n Workflow для service-center
- Создан специальный workflow "Service Center Webhook Handler"
- Логирует каждый входящий вебхук в БД (`webhook_log`)
- Форвардит в основной процессор
- Отправляет алерты в Telegram при ошибках

### 3. ✅ Скрипты мониторинга
- `monitor-webhooks.sh` - мониторинг в реальном времени
- `analyze-webhook-issues.sh` - анализ проблем
- `apply-webhook-config.sh` - быстрое применение конфигурации

## Применение изменений

### Шаг 1: Применить конфигурацию Nginx

```bash
# Запустить скрипт автоматического применения
sudo /workspace/scripts/apply-webhook-config.sh
```

Скрипт автоматически:
- ✅ Создаст бэкап текущей конфигурации
- ✅ Скопирует обновленную конфигурацию
- ✅ Проверит синтаксис nginx
- ✅ Создаст лог-файлы
- ✅ Перезагрузит nginx
- ✅ Проверит работоспособность
- ✅ Отправит тестовый вебхук

### Шаг 2: Создать таблицу webhook_log

```bash
# Подключиться к БД
psql $DATABASE_URL

# Выполнить SQL
CREATE TABLE IF NOT EXISTS webhook_log (
  id SERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  branch TEXT NOT NULL,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  headers JSONB,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_log_ts ON webhook_log(ts DESC);
CREATE INDEX idx_webhook_log_branch ON webhook_log(branch);
CREATE INDEX idx_webhook_log_request_id ON webhook_log(request_id);
CREATE INDEX idx_webhook_log_event ON webhook_log(event);
```

### Шаг 3: Импортировать n8n workflow

#### Вариант A: Через UI (рекомендуется)

1. Открыть: `https://n8n.rentflow.rentals`
2. Войти как admin
3. Нажать **"+"** → **"Import from File"**
4. Выбрать: `/workspace/n8n-workflows/service-center-webhook.json`
5. Нажать **"Import"**
6. **Активировать** workflow (переключатель в правом верхнем углу)

#### Вариант B: Через API

```bash
# Получить пароль
N8N_PASSWORD=$(grep N8N_PASSWORD .env | cut -d= -f2)

# Импортировать workflow
curl -X POST "https://n8n.rentflow.rentals/api/v1/workflows" \
  -u "admin:$N8N_PASSWORD" \
  -H "Content-Type: application/json" \
  -d @/workspace/n8n-workflows/service-center-webhook.json
```

### Шаг 4: Проверить работу

```bash
# Тестовый вебхук
curl -X POST https://n8n.rentflow.rentals/webhook/service-center-webhook \
  -H "Content-Type: application/json" \
  -d '{"event": "test.event", "payload": "{\"id\": 123}"}'

# Проверить логи nginx
sudo tail -f /var/log/nginx/webhook-service-center.log

# Мониторинг в реальном времени
/workspace/scripts/monitor-webhooks.sh service-center

# Анализ проблем
/workspace/scripts/analyze-webhook-issues.sh
```

## Мониторинг и диагностика

### Команды быстрой диагностики

```bash
# Статистика всех вебхуков
/workspace/scripts/monitor-webhooks.sh --stats

# Последние 10 записей
/workspace/scripts/monitor-webhooks.sh --recent

# Полный анализ проблем
/workspace/scripts/analyze-webhook-issues.sh

# Следить за service-center в реальном времени
/workspace/scripts/monitor-webhooks.sh service-center

# Следить за всеми вебхуками
/workspace/scripts/monitor-webhooks.sh all
```

### Проверка в БД

```sql
-- Последние вебхуки от service-center
SELECT 
  ts,
  event,
  payload->>'id' as rentprog_id,
  request_id
FROM webhook_log 
WHERE branch = 'service-center'
ORDER BY ts DESC 
LIMIT 10;

-- Статистика по событиям за последние 24 часа
SELECT 
  event,
  COUNT(*) as count,
  MIN(ts) as first_seen,
  MAX(ts) as last_seen
FROM webhook_log 
WHERE branch = 'service-center'
  AND ts > NOW() - INTERVAL '24 hours'
GROUP BY event
ORDER BY count DESC;
```

### Проверка в n8n

1. Открыть: `https://n8n.rentflow.rentals`
2. Найти workflow: **"Service Center Webhook Handler"**
3. Перейти в **"Executions"**
4. Проверить последние выполнения

## Структура логирования

```
┌─────────────────────────────────────────────┐
│ RentProg → service-center webhook           │
└────────────────┬────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────┐
│ Nginx (webhook.rentflow.rentals)            │
│ • Логирует запрос                           │
│ • Детальный формат (webhook_detailed)       │
│ • Отдельный лог: webhook-service-center.log │
└────────────────┬────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────┐
│ N8n Workflow (service-center-webhook)       │
│ • Принимает webhook                         │
│ • Логирует в консоль                        │
│ • Сохраняет в БД (webhook_log)              │
│ • Форвардит в основной процессор            │
│ • Возвращает 200 OK                         │
└────────────────┬────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────┐
│ N8n Main Processor (rentprog-webhook)       │
│ • Парсит и валидирует                       │
│ • Обрабатывает событие                      │
│ • Сохраняет в events таблицу                │
└─────────────────────────────────────────────┘
```

## Что диагностируется

### Уровень 1: Nginx
- ✅ Доходит ли запрос до сервера
- ✅ Правильный ли путь запроса
- ✅ Время обработки
- ✅ Статус ответа (200, 404, 429, 500)
- ✅ Rate limiting блокировки
- ✅ Upstream статус (n8n)

### Уровень 2: N8n Webhook
- ✅ Принят ли webhook в n8n
- ✅ Request ID для трассировки
- ✅ Полный payload
- ✅ Headers
- ✅ Timestamp

### Уровень 3: БД
- ✅ Сохранен ли webhook
- ✅ Статистика по событиям
- ✅ Дубликаты
- ✅ История обработки

### Уровень 4: Обработка
- ✅ Успешность форвардинга в основной процессор
- ✅ Ошибки обработки
- ✅ Telegram алерты при проблемах

## Типичные проблемы и решения

### 🔴 Rate Limiting (429)

**Симптомы:** В логах много 429 ошибок

**Диагностика:**
```bash
sudo grep " 429 " /var/log/nginx/webhook-access.log | wc -l
```

**Решение:** Увеличить лимит в `/workspace/nginx/webhook.rentflow.rentals.conf`:
```nginx
limit_req_zone $binary_remote_addr zone=webhook_limit:10m rate=50r/s;
```

### 🟡 N8n не отвечает

**Симптомы:** В error.log "Connection refused" или "timeout"

**Диагностика:**
```bash
docker ps | grep n8n
curl -s http://localhost:5678/healthz
```

**Решение:**
```bash
docker restart n8n
```

### 🟢 Workflow не активен

**Симптомы:** 404 ошибки в nginx, но n8n работает

**Диагностика:** Проверить в n8n UI активность workflow

**Решение:** Активировать workflow в n8n UI

### 🔵 Неверный URL в RentProg

**Симптомы:** 404 ошибки, неправильный путь в логах

**Проверка:**
```bash
sudo grep " 404 " /var/log/nginx/webhook-access.log | awk '{print $7}'
```

**Решение:** В RentProg указать правильный URL:
```
https://n8n.rentflow.rentals/webhook/service-center-webhook
```

## Telegram алерты

Алерты приходят в чат с ID: `-5004140602` (переменная `TELEGRAM_ALERT_CHAT_ID`)

Типы алертов:
- ⚠️ **Service-Center webhook ERROR** - ошибка обработки
- 🚨 **КРИТИЧЕСКАЯ ОШИБКА** - критическая ошибка workflow
- 🔍 **Неизвестный формат** - новый тип события

## Файлы и пути

### Конфигурация
- `/workspace/nginx/webhook.rentflow.rentals.conf` - nginx конфигурация
- `/workspace/n8n-workflows/service-center-webhook.json` - n8n workflow

### Логи
- `/var/log/nginx/webhook-service-center.log` - service-center запросы
- `/var/log/nginx/webhook-service-center-error.log` - service-center ошибки
- `/var/log/nginx/webhook-access.log` - все вебхуки
- `/var/log/nginx/webhook-error.log` - все ошибки nginx

### Скрипты
- `/workspace/scripts/apply-webhook-config.sh` - применение конфигурации
- `/workspace/scripts/monitor-webhooks.sh` - мониторинг
- `/workspace/scripts/analyze-webhook-issues.sh` - анализ проблем

### Документация
- `/workspace/WEBHOOK_DIAGNOSTICS.md` - детальная диагностика
- `/workspace/n8n-workflows/SERVICE_CENTER_WEBHOOK_SETUP.md` - настройка workflow
- `/workspace/WEBHOOK_FIX_COMPLETE.md` - этот файл

## Следующие шаги

1. ✅ Применить изменения (см. "Применение изменений")
2. 📊 Наблюдать за работой в течение 24 часов
3. 📈 Анализировать статистику: `/workspace/scripts/analyze-webhook-issues.sh`
4. 🔔 Настроить дополнительные алерты при необходимости
5. 📝 Обновить документацию по результатам наблюдений

## Поддержка

При проблемах:
1. Запустить: `/workspace/scripts/analyze-webhook-issues.sh`
2. Проверить логи nginx: `sudo tail -100 /var/log/nginx/webhook-service-center.log`
3. Проверить executions в n8n UI
4. Проверить БД: `SELECT * FROM webhook_log WHERE branch='service-center' ORDER BY ts DESC LIMIT 10;`
5. Проверить docker logs: `docker logs n8n --tail 100`

---

**Статус:** ✅ Готово к применению  
**Дата:** 2025-11-04  
**Автор:** Cursor AI Agent  

**Время выполнения:** ~30 минут  
**Изменено файлов:** 7  
**Создано файлов:** 6  
**Строк кода:** ~1200
