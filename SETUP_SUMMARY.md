# Итоговый отчет по настройке

## ✅ Выполнено

### 1. Миграция БД
SQL для выполнения в Neon Console (https://console.neon.tech/app/projects/rough-heart-ahnybmq0/sql):

```sql
-- Добавляем поле processed
ALTER TABLE events ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE;

-- Добавляем unique constraint
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

-- Создаем индекс
CREATE INDEX IF NOT EXISTS idx_events_processed 
ON events(processed) 
WHERE processed = FALSE;
```

### 2. Переменные окружения

**В docker-compose.yml (уже настроены):**
- `RENTPROG_HEALTH_URL=http://46.224.17.15:3000/rentprog/health`
- `TELEGRAM_ALERT_CHAT_ID=-5004140602`
- `ORCHESTRATOR_URL=http://46.224.17.15:3000`

Эти переменные автоматически передаются в n8n контейнер и доступны как `{{ $env.VARIABLE_NAME }}` в workflows.

### 3. Импорт workflow

Workflow `rentprog-upsert-processor.json` нужно импортировать вручную через n8n UI:
1. Откройте http://46.224.17.15:5678
2. Workflows → Import from File
3. Выберите `n8n-workflows/rentprog-upsert-processor.json`
4. Назначьте credentials:
   - PostgreSQL → "PostgreSQL"
   - HTTP Request → настройте для вызова Jarvis API
5. Активируйте workflow

### 4. Общий адрес вебхука

**Для всех филиалов RentProg используйте:**
```
https://geodrive.netlify.app/webhook/rentprog-webhook
```

Этот адрес проксируется на n8n через Netlify.

## ⚠️ Требуется действие

1. **Выполнить миграцию БД** через Neon Console
2. **Импортировать workflow** вручную через UI n8n (или обновить API ключ для автоматического импорта)
3. **Прописать адрес вебхука** во всех 4 филиалах RentProg

## 📋 Структура

- ✅ `netlify.toml` - обновлен для проксирования
- ✅ `n8n-workflows/rentprog-webhooks-monitor.json` - обновлен для обработки дубликатов
- ✅ `n8n-workflows/rentprog-upsert-processor.json` - создан новый workflow
- ✅ `src/api/index.ts` - добавлен endpoint `/process-event`
- ✅ `setup/update_events_table.sql` - SQL для миграции

