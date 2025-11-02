# Финальный статус настройки

## ✅ Выполнено автоматически

### 1. Обновлен скрипт импорта workflow
- ✅ Добавлен `rentprog-upsert-processor.json` в `setup/setup_n8n_via_curl.ps1`
- ✅ Скрипт готов к импорту всех 4 workflow

### 2. Создана обязательная документация
- ✅ `docs/N8N_WORKFLOW_IMPORT_GUIDE.md` - подробная инструкция
- ✅ `docs/AGENT_INSTRUCTIONS.md` - краткие инструкции для агента
- ✅ Обновлен `README.md` с ссылками

### 3. Проверены переменные окружения
- ✅ Все переменные настроены в `docker-compose.yml`
- ✅ Переменные передаются в n8n контейнер

### 4. Обновлены файлы
- ✅ `netlify.toml` - проксирование на n8n
- ✅ `n8n-workflows/rentprog-webhooks-monitor.json` - обработка дубликатов
- ✅ `n8n-workflows/rentprog-upsert-processor.json` - новый workflow
- ✅ `src/api/index.ts` - endpoint `/process-event`

---

## ⚠️ Требуется действие (из-за устаревшего API ключа)

### 1. Получить новый API ключ n8n

1. Откройте: `http://46.224.17.15:5678`
2. Settings → API → Create API Key
3. Скопируйте ключ

### 2. Обновить ключ и запустить скрипт

```powershell
# Установить новый ключ
$env:N8N_API_KEY = "your_new_api_key_here"

# Запустить импорт всех workflow
powershell -ExecutionPolicy Bypass -File .\setup\setup_n8n_via_curl.ps1
```

Скрипт автоматически импортирует все 4 workflow с назначением credentials.

### 3. Выполнить миграцию БД

SQL для Neon Console (https://console.neon.tech/app/projects/rough-heart-ahnybmq0/sql):

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

---

## 📋 Итоговый список workflow

После выполнения импорта будут доступны:

1. **RentProg Webhooks Monitor** - принимает вебхуки, сохраняет в events, отправляет алерты
2. **Sync Progress** - логирует прогресс синхронизации
3. **Health & Status** - проверяет здоровье системы каждые 5 минут
4. **RentProg Upsert Processor** - обрабатывает события для upsert (каждые 5 минут)

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

