# Отчет о выполнении настройки

## ✅ Выполнено

### 1. Обновлен скрипт импорта workflow
- Добавлен `rentprog-upsert-processor.json` в массив `$workflows` в `setup/setup_n8n_via_curl.ps1`
- Скрипт готов к запуску для импорта всех 4 workflow

### 2. Создана обязательная документация
- ✅ `docs/N8N_WORKFLOW_IMPORT_GUIDE.md` - подробная инструкция по работе с n8n
- ✅ `docs/AGENT_INSTRUCTIONS.md` - краткие инструкции для агента Cursor
- ✅ Обновлен `README.md` с ссылками на документацию

### 3. Настройка переменных окружения
Переменные настроены в `docker-compose.yml`:
- `RENTPROG_HEALTH_URL=http://46.224.17.15:3000/rentprog/health`
- `TELEGRAM_ALERT_CHAT_ID=-5004140602`
- `ORCHESTRATOR_URL=http://46.224.17.15:3000`

Эти переменные автоматически передаются в n8n контейнер.

---

## 📋 Осталось выполнить вручную

### 1. Миграция БД

Выполните SQL в Neon Console: https://console.neon.tech/app/projects/rough-heart-ahnybmq0/sql

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

### 2. Запустить скрипт импорта workflow

После выполнения миграции запустите:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup\setup_n8n_via_curl.ps1
```

Скрипт автоматически:
- Проверит/создаст credentials (PostgreSQL, Telegram Bot)
- Импортирует все 4 workflow:
  - RentProg Webhooks Monitor
  - Sync Progress
  - Health & Status
  - RentProg Upsert Processor (новый)
- Назначит credentials в нодах
- Активирует все workflow

---

## 📝 Итоговый адрес вебхука

**Для всех филиалов RentProg используйте:**
```
https://geodrive.netlify.app/webhook/rentprog-webhook
```

Этот адрес проксируется через Netlify на n8n.

---

## 📚 Документация

- [docs/N8N_WORKFLOW_IMPORT_GUIDE.md](./docs/N8N_WORKFLOW_IMPORT_GUIDE.md) - ⚠️ **ОБЯЗАТЕЛЬНАЯ инструкция** по работе с n8n
- [docs/AGENT_INSTRUCTIONS.md](./docs/AGENT_INSTRUCTIONS.md) - Инструкции для агента

