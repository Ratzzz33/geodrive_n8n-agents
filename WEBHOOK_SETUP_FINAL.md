# Итоговая настройка вебхуков RentProg → n8n

## Общий адрес для всех филиалов

**Единственный адрес, который нужно прописать во всех 4 филиалах RentProg:**

```
https://geodrive.netlify.app/webhook/rentprog-webhook
```

Этот адрес проксируется через Netlify на n8n сервер:
- `http://46.224.17.15:5678/webhook/rentprog-webhook`

## Что сделано

### 1. Netlify проксирование (`netlify.toml`)
- `/webhook/rentprog-webhook` → проксируется на n8n
- `/n8n/*` → проксируется на UI n8n (для доступа через Netlify домен)

### 2. Обработка дубликатов
- Добавлен unique constraint в таблицу `events` на `(branch, type, ext_id)`
- Workflow использует `ON CONFLICT DO NOTHING` для пропуска дубликатов

### 3. Upsert процессор
- Создан workflow `rentprog-upsert-processor.json` с cron (каждые 5 минут)
- Обрабатывает события из таблицы `events` (где `processed = false`)
- Отправляет запросы в Jarvis API (`/process-event`) для выполнения upsert

### 4. API endpoint
- Добавлен endpoint `/process-event` в Jarvis API для обработки событий из n8n
- Выполняет auto-fetch и upsert через существующую логику

## Настройка в RentProg

В настройках вебхуков во всех 4 филиалах (tbilisi, batumi, kutaisi, service-center) укажите:

**URL вебхука:**
```
https://geodrive.netlify.app/webhook/rentprog-webhook
```

**Query параметры (опционально, branch можно передавать в теле):**
- branch можно передавать в query параметре `?branch=tbilisi` или в теле запроса

## Настройка в n8n

В настройках webhook workflow `RentProg Webhooks Monitor`:

**Production URL:**
```
https://geodrive.netlify.app/webhook/rentprog-webhook
```

Или напрямую:
```
http://46.224.17.15:5678/webhook/rentprog-webhook
```

## Миграция БД

Выполните SQL для обновления таблицы `events`:

```sql
-- Файл: setup/update_events_table.sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE;

-- Добавляем unique constraint для предотвращения дубликатов
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'events_branch_type_ext_id_unique'
  ) THEN
    ALTER TABLE events 
    ADD CONSTRAINT events_branch_type_ext_id_unique 
    UNIQUE (branch, type, ext_id);
  END IF;
END $$;

-- Создаем индекс для быстрого поиска непроработанных событий
CREATE INDEX IF NOT EXISTS idx_events_processed 
ON events(processed) 
WHERE processed = FALSE;
```

## Workflows в n8n

1. **RentProg Webhooks Monitor** (уже настроен)
   - Принимает вебхуки от RentProg
   - Сохраняет в таблицу `events` с обработкой дубликатов

2. **RentProg Upsert Processor** (новый, нужно импортировать)
   - Cron каждые 5 минут
   - Обрабатывает непроработанные события
   - Вызывает Jarvis API для upsert

3. **Sync Progress** (уже настроен)
   - Логирует прогресс синхронизации

4. **Health & Status** (уже настроен)
   - Проверяет здоровье системы каждые 5 минут

## Переменные окружения

В `.env` на сервере:
```env
RENTPROG_HEALTH_URL=http://46.224.17.15:3000/rentprog/health
TELEGRAM_ALERT_CHAT_ID=-5004140602
ORCHESTRATOR_URL=http://46.224.17.15:3000
```

В n8n через UI (Settings → Environment Variables):
```
RENTPROG_HEALTH_URL=http://46.224.17.15:3000/rentprog/health
TELEGRAM_ALERT_CHAT_ID=-5004140602
ORCHESTRATOR_URL=http://46.224.17.15:3000
```

## Итог

**Один адрес для всех филиалов:**
```
https://geodrive.netlify.app/webhook/rentprog-webhook
```

Пропишите его во всех 4 филиалах RentProg и в настройках webhook в n8n.

