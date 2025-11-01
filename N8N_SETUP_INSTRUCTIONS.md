# Инструкция по настройке n8n для мониторинга RentProg

## Обзор

Настройка включает:
1. Создание таблиц в Neon PostgreSQL
2. Импорт 3 workflow в n8n
3. Создание credentials (PostgreSQL, Telegram Bot)
4. Настройка переменных окружения в n8n
5. Активация workflow

---

## 1. Создание таблиц в Neon

Выполните SQL в вашей Neon базе данных:

```sql
-- События вебхуков RentProg
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  branch TEXT,
  type TEXT,
  ext_id TEXT,
  ok BOOLEAN DEFAULT TRUE,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_branch ON events(branch);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);

-- Прогресс синхронизации
CREATE TABLE IF NOT EXISTS sync_runs (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  branch TEXT,
  entity TEXT,        -- 'car'|'client'|'booking'
  page INT DEFAULT 0,
  added INT DEFAULT 0,
  updated INT DEFAULT 0,
  ok BOOLEAN DEFAULT TRUE,
  msg TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_ts ON sync_runs(ts);
CREATE INDEX IF NOT EXISTS idx_sync_runs_branch ON sync_runs(branch);
CREATE INDEX IF NOT EXISTS idx_sync_runs_entity ON sync_runs(entity);

-- Health check статусы
CREATE TABLE IF NOT EXISTS health (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  branch TEXT,
  ok BOOLEAN,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_health_ts ON health(ts);
CREATE INDEX IF NOT EXISTS idx_health_branch ON health(branch);
```

**Или используйте файл:** `setup/create_n8n_tables.sql`

### Подключение к Neon:

```bash
# Используйте psql или Neon Dashboard → SQL Editor
psql "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

---

## 2. Импорт workflow в n8n

### Вариант A: Через UI n8n

1. Откройте n8n: `http://46.224.17.15:5678`
2. Войдите в систему
3. Нажмите **Workflows** → **Import from File**
4. Импортируйте по очереди:
   - `n8n-workflows/rentprog-webhooks-monitor.json`
   - `n8n-workflows/sync-progress.json`
   - `n8n-workflows/health-status.json`

### Вариант B: Через REST API (если настроен N8N_API_KEY)

```powershell
# Используйте PowerShell скрипт для импорта workflow:
.\n8n-api.ps1 create -FilePath "n8n-workflows/rentprog-webhooks-monitor.json"
.\n8n-api.ps1 create -FilePath "n8n-workflows/sync-progress.json"
.\n8n-api.ps1 create -FilePath "n8n-workflows/health-status.json"
```

См. [README_N8N_API.md](README_N8N_API.md) для подробностей по работе с n8n через REST API.

---

## 3. Создание Credentials в n8n

### 3.1 PostgreSQL Credentials

1. В n8n: **Credentials** → **Add Credential**
2. Выберите **Postgres**
3. Заполните:
   - **Host:** `ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech`
   - **Database:** `neondb`
   - **User:** `neondb_owner`
   - **Password:** `npg_cHIT9Kxfk1Am`
   - **Port:** `5432`
   - **SSL:** включить (SSLMode: require)
4. **Name:** `PostgreSQL`
5. **Save**

### 3.2 Telegram Bot Credentials

1. В n8n: **Credentials** → **Add Credential**
2. Выберите **Telegram**
3. Заполните:
   - **Access Token:** токен бота `@n8n_alert_geodrive_bot`
   - (Получите токен у @BotFather в Telegram)
4. **Name:** `Telegram Bot`
5. **Save**

### Привязка к workflow

После создания credentials:
1. Откройте каждый workflow
2. Для каждого **Postgres** нода:
   - Нажмите на нод
   - В поле **Credential** выберите **PostgreSQL**
   - **Save**
3. Для каждого **Telegram** нода:
   - Нажмите на нод
   - В поле **Credential** выберите **Telegram Bot**
   - **Save**

---

## 4. Настройка переменных окружения в n8n

В n8n UI: **Settings** → **Environment Variables**

Добавьте:

```
RENTPROG_HEALTH_URL=http://46.224.17.15:3000/rentprog/health
TELEGRAM_ALERT_CHAT_ID=<ваш_chat_id_или_id_группы>
```

**Как получить TELEGRAM_ALERT_CHAT_ID:**
1. Напишите боту @userinfobot в Telegram
2. Он вернет ваш User ID
3. Или для группы: добавьте бота в группу и используйте ID группы

---

## 5. Активация workflow

Для каждого из 3 workflow:

1. Откройте workflow
2. Нажмите **Active** (переключатель в правом верхнем углу)
3. Проверьте, что все ноды сохранены и credentials привязаны

---

## 6. Настройка Jarvis (на сервере)

Убедитесь, что в `.env` на сервере установлено:

```env
N8N_BASE_WEBHOOK_URL=http://46.224.17.15/webhook
```

**Важно:** После изменений в `.env` перезапустите бота/сервисы.

---

## 7. Тестирование

### Тест вебхука RentProg:

```bash
curl -X POST "https://geodrive.netlify.app/webhooks/rentprog/tbilisi" \
  -H "Content-Type: application/json" \
  -d '{"event":"booking.issue.planned","payload":{"id":"test_123"}}'
```

**Ожидаемый результат:**
- В n8n → **Executions** видно выполнение "RentProg Webhooks Monitor"
- В таблице `events` появилась запись
- Если `ok:false`, придет Telegram алерт

### Тест синхронизации:

В боте выполните:
```
/sync_rentprog
```

**Ожидаемый результат:**
- В n8n → **Executions** видно выполнения "Sync Progress"
- В таблице `sync_runs` появляются записи каждые 20 записей

### Тест Health Check:

Health workflow запускается автоматически каждые 5 минут через Cron.

**Проверка:**
- В таблице `health` появляются записи
- При `ok:false` придет Telegram алерт

---

## Проверка статуса

### В боте:
```
/status
```

Должен показать зеленый статус для RentProg.

### В n8n:
1. Откройте каждый workflow
2. Проверьте **Executions** — должны быть видны выполнения
3. Проверьте таблицы в Neon через SQL:

```sql
-- События
SELECT * FROM events ORDER BY ts DESC LIMIT 10;

-- Прогресс синхронизации
SELECT * FROM sync_runs ORDER BY ts DESC LIMIT 10;

-- Health
SELECT * FROM health ORDER BY ts DESC LIMIT 10;
```

---

## Troubleshooting

### Проблема: Workflow не активируется

**Решение:**
- Проверьте, что все credentials созданы и привязаны
- Проверьте переменные окружения
- Проверьте логи n8n: `docker compose logs n8n`

### Проблема: Нет записей в таблицах

**Решение:**
- Проверьте подключение к PostgreSQL в credentials
- Проверьте, что таблицы созданы
- Проверьте логи выполнения workflow в n8n

### Проблема: Telegram алерты не приходят

**Решение:**
- Проверьте токен бота в credentials
- Проверьте `TELEGRAM_ALERT_CHAT_ID`
- Убедитесь, что бот запущен и может отправлять сообщения

### Проблема: Webhook не получает данные

**Решение:**
- Проверьте `N8N_BASE_WEBHOOK_URL` в `.env` на сервере
- Проверьте, что бот отправляет события в n8n (логи)
- Проверьте URL webhook в n8n workflow (должен быть `/webhook/rentprog-webhook`)

---

## Следующие шаги

После успешной настройки:
1. ✅ Все 3 workflow активны
2. ✅ Таблицы получают данные
3. ✅ Telegram алерты работают
4. ✅ /status показывает зеленый статус

Мониторинг работает! 🎉

