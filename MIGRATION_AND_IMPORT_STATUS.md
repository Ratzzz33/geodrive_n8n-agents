# Статус выполнения миграции и импорта

## ✅ Выполнено

### 1. Обновлен скрипт импорта
- ✅ Добавлен `rentprog-upsert-processor.json` в `setup/import_n8n_workflows.ts`
- ✅ Создан PowerShell скрипт `setup/import_workflow_powershell.ps1` для импорта всех 4 workflow

### 2. SQL миграция готова
- ✅ Файл: `setup/update_events_table.sql`
- ✅ Скрипт для выполнения: `setup/run_migration_using_project.ts`

---

## ⚠️ Требуется выполнить

### 1. Миграция БД

**Способ 1: Через Neon Console (рекомендуется)**
1. Откройте: https://console.neon.tech/app/projects/rough-heart-ahnybmq0/sql
2. Скопируйте содержимое файла `setup/update_events_table.sql`
3. Выполните SQL команды

**Способ 2: Через Node.js (если доступен)**
```bash
npx tsx setup/run_migration_using_project.ts
```

**SQL команды:**
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

### 2. Импорт нового workflow

**Статус:** API возвращает 401 Unauthorized

**Проблема:** API ключ может быть устаревшим или неверным

**Решение:**

**Вариант A: Получить новый API ключ**
1. Откройте: http://46.224.17.15:5678
2. Settings → API → Create API Key
3. Обновите ключ в скрипте или переменной окружения:
   ```powershell
   $env:N8N_API_KEY = "новый_ключ"
   powershell -ExecutionPolicy Bypass -File setup/import_workflow_powershell.ps1
   ```

**Вариант B: Импорт через UI n8n**
1. Откройте: http://46.224.17.15:5678
2. Workflows → Import from File
3. Выберите: `n8n-workflows/rentprog-upsert-processor.json`
4. Назначьте credentials (PostgreSQL) в нодах
5. Активируйте workflow

**Вариант C: Использовать TypeScript скрипт (если Node.js доступен)**
```bash
npx tsx setup/import_n8n_workflows.ts
```

---

## 📋 Итоговый список workflow (4 шт)

1. ✅ **RentProg Webhooks Monitor** - уже импортирован ранее
2. ✅ **Sync Progress** - уже импортирован ранее  
3. ✅ **Health & Status** - уже импортирован ранее
4. ⏳ **RentProg Upsert Processor** - требуется импорт

---

## 🔧 Команды для выполнения

### Миграция БД:
```sql
-- Выполнить в Neon Console
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

### Импорт workflow (после получения нового API ключа):
```powershell
# Установить новый API ключ
$env:N8N_API_KEY = "ваш_новый_ключ"

# Выполнить импорт
powershell -ExecutionPolicy Bypass -File setup/import_workflow_powershell.ps1
```

---

**Все файлы готовы! Осталось выполнить миграцию БД и импорт нового workflow.** ✅

