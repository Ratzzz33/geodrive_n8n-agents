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
- Принимает вебхуки от Netlify Function (`/rentprog/:branch`)
- Сохраняет события в Data Table "events"
- Отправляет Telegram алерты при ошибках валидации

**Data Table "events":**
- `ts` - timestamp
- `branch` - филиал
- `type` - тип события
- `ext_id` - внешний ID
- `ok` - успешность обработки
- `reason` - причина ошибки (если есть)

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

**Data Table "health":**
- `ts` - timestamp
- `branch` - филиал
- `ok` - статус (true/false)
- `reason` - причина ошибки

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

**Data Table "sync_runs":**
- `ts` - timestamp
- `branch` - филиал
- `entity` - тип сущности ('car', 'client', 'booking')
- `page` - номер страницы пагинации
- `added` - количество созданных
- `updated` - количество обновленных
- `ok` - успешность операции
- `msg` - сообщение (ошибка или статус)

**Credentials:**
- PostgreSQL (для Data Table)

**Переменные окружения:**
- `SYNC_STATUS_URL` - URL для опроса статуса синхронизации

## Создание Data Tables

Перед импортом workflow'ов создайте следующие таблицы в PostgreSQL:

```sql
-- Таблица событий вебхуков
CREATE TABLE IF NOT EXISTS events (
  ts TIMESTAMPTZ DEFAULT NOW(),
  branch TEXT NOT NULL,
  type TEXT NOT NULL,
  ext_id TEXT,
  ok BOOLEAN DEFAULT true,
  reason TEXT
);

-- Таблица health checks
CREATE TABLE IF NOT EXISTS health (
  ts TIMESTAMPTZ DEFAULT NOW(),
  branch TEXT NOT NULL,
  ok BOOLEAN NOT NULL,
  reason TEXT
);

-- Таблица прогресса синхронизации
CREATE TABLE IF NOT EXISTS sync_runs (
  ts TIMESTAMPTZ DEFAULT NOW(),
  branch TEXT NOT NULL,
  entity TEXT NOT NULL,
  page INTEGER DEFAULT 0,
  added INTEGER DEFAULT 0,
  updated INTEGER DEFAULT 0,
  ok BOOLEAN DEFAULT true,
  msg TEXT
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_branch ON events(branch);
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

