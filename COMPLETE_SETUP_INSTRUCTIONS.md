# Финальные инструкции по выполнению оставшихся задач

## ✅ Что уже выполнено

1. ✅ Обновлен `netlify.toml` для проксирования на n8n
2. ✅ Обновлен workflow `rentprog-webhooks-monitor.json` для обработки дубликатов
3. ✅ Создан новый workflow `rentprog-upsert-processor.json`
4. ✅ Добавлен endpoint `/process-event` в API
5. ✅ Добавлен новый workflow в скрипт `setup_n8n_via_curl.ps1`
6. ✅ Создана обязательная документация
7. ✅ Проверены переменные окружения в `docker-compose.yml`

---

## 📋 Осталось выполнить

### 1. Миграция БД

**Вариант A: Через Neon Console (рекомендуется)**

1. Откройте: https://console.neon.tech/app/projects/rough-heart-ahnybmq0/sql
2. Выполните SQL из файла `setup/update_events_table.sql`:

```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE;

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

CREATE INDEX IF NOT EXISTS idx_events_processed 
ON events(processed) 
WHERE processed = FALSE;
```

**Вариант B: Через TypeScript (если есть Node.js в PATH)**

```bash
npm run tsx setup/run_migration_using_project.ts
```

### 2. Импорт workflow в n8n

**Способ: Через PowerShell скрипт (как для первых трех workflow)**

```powershell
powershell -ExecutionPolicy Bypass -File .\setup\setup_n8n_via_curl.ps1
```

Скрипт импортирует все 4 workflow:
- RentProg Webhooks Monitor
- Sync Progress
- Health & Status
- RentProg Upsert Processor (новый)

**Если получаете 401 ошибку:**
- Проверьте, что n8n доступен: `http://46.224.17.15:5678`
- API ключ в скрипте должен быть рабочим
- Убедитесь, что n8n запущен и доступен

### 3. Проверка переменных окружения

Переменные уже настроены в `docker-compose.yml`:
- ✅ `RENTPROG_HEALTH_URL=http://46.224.17.15:3000/rentprog/health`
- ✅ `TELEGRAM_ALERT_CHAT_ID=-5004140602`
- ✅ `ORCHESTRATOR_URL=http://46.224.17.15:3000`

Эти переменные автоматически передаются в n8n контейнер через Docker.

---

## 🔗 Итоговый адрес вебхука

**Для всех филиалов RentProg:**
```
https://geodrive.netlify.app/webhook/rentprog-webhook
```

---

## 📚 Документация

- **[docs/N8N_WORKFLOW_IMPORT_GUIDE.md](./docs/N8N_WORKFLOW_IMPORT_GUIDE.md)** - ⚠️ ОБЯЗАТЕЛЬНАЯ инструкция
- **[docs/AGENT_INSTRUCTIONS.md](./docs/AGENT_INSTRUCTIONS.md)** - Инструкции для агента

