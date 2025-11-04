# n8n Workflows для RentProg v1

Описание workflow'ов для мониторинга и визуализации интеграции с RentProg.

## Установка

1. Откройте n8n интерфейс
2. Для каждого workflow:
   - Нажмите "Import from File"
   - Выберите соответствующий JSON файл
   - Настройте credentials (PostgreSQL, Telegram)
   - Активируйте workflow

## Workflows

### 1. RentProg Webhooks Monitor

**Файл:** `rentprog-webhooks-monitor.json`

**Описание:** 
- Принимает вебхуки через Nginx endpoint (`https://webhook.rentflow.rentals`)
- Сохраняет события в таблицу `events`
- Отправляет Telegram алерты при ошибках валидации

**Структура таблицы `events`:**
- `id BIGSERIAL PRIMARY KEY`
- `ts TIMESTAMPTZ DEFAULT now()`
- `branch TEXT`
- `type TEXT`
- `ext_id TEXT`
- `ok BOOLEAN DEFAULT TRUE`
- `reason TEXT`
- `processed BOOLEAN DEFAULT FALSE`
- `CONSTRAINT events_branch_type_ext_id_unique UNIQUE (branch, type, ext_id)`

**Credentials:**
- PostgreSQL (для Data Table)
- Telegram Bot API (для алертов)

### 2. Health & Status

**Файл:** `health-status.json`

**Описание:**
- Cron каждые 5 минут
- HTTP Request к `/rentprog/health`
- Сохраняет статус каждого филиала в Data Table "health"
- Отправляет Telegram алерты при !ok

**Структура таблицы `health`:**
- `id BIGSERIAL PRIMARY KEY`
- `ts TIMESTAMPTZ DEFAULT now()`
- `branch TEXT`
- `ok BOOLEAN`
- `reason TEXT`

**Credentials:**
- PostgreSQL (для Data Table)
- Telegram Bot API (для алертов)

**Переменные окружения:**
- `RENTPROG_HEALTH_URL` - URL health check endpoint
- `TELEGRAM_ALERT_CHAT_ID` - ID чата для алертов

### 3. Sync Progress

**Файл:** `sync-progress.json`

**Описание:**
- Webhook endpoint `/sync/progress` для получения прогресса от Jarvis
- Cron каждые 10 минут для опроса статуса синхронизации
- Сохраняет прогресс в Data Table "sync_runs"

**Структура таблицы `sync_runs`:**
- `id BIGSERIAL PRIMARY KEY`
- `ts TIMESTAMPTZ DEFAULT now()`
- `branch TEXT`
- `entity TEXT`
- `page INT DEFAULT 0`
- `added INT DEFAULT 0`
- `updated INT DEFAULT 0`
- `ok BOOLEAN DEFAULT TRUE`
- `msg TEXT`

**Credentials:**
- PostgreSQL (для Data Table)

**Переменные окружения:**
- `SYNC_STATUS_URL` - URL для опроса статуса синхронизации (по умолчанию `http://46.224.17.15:3000/sync/status`)

## Создание Data Tables

Перед импортом workflow'ов создайте следующие таблицы в PostgreSQL:

```sql
-- Таблица событий вебхуков
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ DEFAULT now(),
  branch TEXT,
  type TEXT,
  ext_id TEXT,
  ok BOOLEAN DEFAULT TRUE,
  reason TEXT,
  processed BOOLEAN DEFAULT FALSE,
  CONSTRAINT events_branch_type_ext_id_unique UNIQUE (branch, type, ext_id)
);

-- Таблица health checks
CREATE TABLE IF NOT EXISTS health (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ DEFAULT now(),
  branch TEXT,
  ok BOOLEAN,
  reason TEXT
);

-- Таблица прогресса синхронизации
CREATE TABLE IF NOT EXISTS sync_runs (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ DEFAULT now(),
  branch TEXT,
  entity TEXT,
  page INTEGER DEFAULT 0,
  added INTEGER DEFAULT 0,
  updated INTEGER DEFAULT 0,
  ok BOOLEAN DEFAULT TRUE,
  msg TEXT
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_branch ON events(branch);
CREATE INDEX IF NOT EXISTS idx_events_processed ON events(processed) WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_health_ts ON health(ts DESC);
CREATE INDEX IF NOT EXISTS idx_health_branch ON health(branch);
CREATE INDEX IF NOT EXISTS idx_sync_runs_ts ON sync_runs(ts DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_branch ON sync_runs(branch);
```

## Интеграция с Jarvis

Для отправки прогресса синхронизации в n8n добавьте в код синхронизации:

```typescript
import axios from 'axios';

// При каждом батче пагинации
await axios.post(config.n8nEventsUrl, {
  ts: new Date().toISOString(),
  branch: branchCode,
  entity: 'car' | 'client' | 'booking',
  page: currentPage,
  added: countCreated,
  updated: countUpdated,
  ok: true,
  msg: 'Batch processed'
}).catch(err => logger.error('Failed to send sync progress', err));
```

---

## 🆕 Service Center Webhook Handler (добавлен 2025-11-04)

**Файл:** `service-center-webhook.json`

**Описание:**
Специальный обработчик вебхуков от филиала service-center с расширенной диагностикой и логированием.

**Endpoint:** `https://n8n.rentflow.rentals/webhook/service-center-webhook`

**Функции:**
- ✅ Логирование всех входящих вебхуков с timestamp и request_id
- ✅ Сохранение в таблицу `webhook_log` для анализа
- ✅ Форвардинг в основной процессор (`rentprog-webhook`)
- ✅ Telegram алерты при ошибках
- ✅ Детальное логирование headers и payload
- ✅ Всегда возвращает 200 OK для RentProg

**Таблица `webhook_log`:**
```sql
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

**Миграция:** `/workspace/migrations/create_webhook_log.sql`

**Credentials:**
- PostgreSQL (для сохранения в БД)
- Telegram Bot API (для алертов)

**Документация:** [SERVICE_CENTER_WEBHOOK_SETUP.md](./SERVICE_CENTER_WEBHOOK_SETUP.md)

**Мониторинг:**
```bash
# Статистика
/workspace/scripts/monitor-webhooks.sh --stats

# Реальное время
/workspace/scripts/monitor-webhooks.sh service-center

# Анализ проблем
/workspace/scripts/analyze-webhook-issues.sh
```

**Быстрый старт:** [QUICKSTART_WEBHOOK_FIX.md](../QUICKSTART_WEBHOOK_FIX.md)

