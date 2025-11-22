# Сводка: Workflow для обновления отслеживания источника изменений

**Дата:** 2025-01-20

---

## ✅ Уже обновлено (автоматически)

### 1. RentProg Upsert Processor
- **Файл:** `n8n-workflows/rentprog-upsert-processor.json`
- **Нода:** "Process Event via Jarvis" (ID: `process-event-node`)
- **Изменения:** Добавлены headers:
  - `X-Source: n8n_workflow`
  - `X-Workflow-Id: ={{ $workflow.id }}`
  - `X-Workflow-Name: ={{ $workflow.name }}`
  - `X-Execution-Id: ={{ $execution.id }}`
- **Статус:** ✅ Готово к импорту

### 2. RentProg Events Auto Processor
- **Файл:** `n8n-workflows/rentprog-events-auto-processor.json`
- **Нода:** "Process Event via Jarvis" (ID: `process-event`)
- **Изменения:** Добавлены headers (те же, что выше)
- **Статус:** ✅ Готово к импорту

---

## ⚠️ Требуют ручного обновления

### 3. Processor Workflows (4 филиала)

**Файлы:**
- `tbilisi-processor.json`
- `batumi-processor.json`
- `kutaisi-processor.json`
- `service-center-processor.json`

**Что сделать:**
1. Найти ноду "Save to Events" (Postgres)
2. Добавить новую ноду HTTP Request после неё
3. Настроить как в примере ниже

**Нода для добавления:**

```
Тип: HTTP Request
Название: Process Event via Jarvis
URL: ={{ $env.ORCHESTRATOR_URL || 'http://46.224.17.15:3000' }}/process-event
Method: POST

Headers:
- X-Source: n8n_workflow
- X-Workflow-Id: ={{ $workflow.id }}
- X-Workflow-Name: ={{ $workflow.name }}
- X-Execution-Id: ={{ $execution.id }}

Body:
- branch: ={{ $('Parse Webhook').item.json.metadata.branch || 'tbilisi' }}
- type: ={{ $('Parse Webhook').item.json.event_name }}
- rentprog_id: ={{ $('Parse Webhook').item.json.rentprog_id }}
- eventId: ={{ $('Save to Events').item.json.id }}
```

**Подключение:**
- "Save to Events" → "Process Event via Jarvis" → следующая нода

---

### 4. Snapshot Workflows

**Файлы:**
- `rentprog-cars-snapshot.json`
- `rentprog-cars-snapshot-parallel.json`
- `rentprog-cars-snapshot-updated.json`
- `rentprog-car-prices-daily.json`

**Проблема:** Эти workflow вставляют данные в `rentprog_car_states_snapshot`, затем триггер синхронизирует в `cars`.

**Решение:** Обновить триггер `sync_cars_from_snapshot_trigger`

**Миграция:** `setup/migrations/022_update_snapshot_trigger_change_tracking.sql` (создать)

---

### 5. History Parser Workflows

**Файлы:**
- `rentprog-events-scraper.json`
- `history-matcher-processor.json`

**Что сделать:**
- Если вызывают Jarvis API → добавить headers (как в пункте 3)
- Если напрямую обновляют БД → добавить поля в UPDATE запросы:
  ```sql
  updated_by_source = 'rentprog_history',
  updated_by_workflow = '={{ $workflow.name }}',
  updated_by_execution_id = '={{ $execution.id }}'
  ```

---

## 📋 Итоговый список

### HTTP Request ноды (вызывают `/process-event`)

| Workflow | Нода | Статус | Действие |
|----------|------|--------|----------|
| rentprog-upsert-processor.json | Process Event via Jarvis | ✅ Обновлено | Импортировать |
| rentprog-events-auto-processor.json | Process Event via Jarvis | ✅ Обновлено | Импортировать |
| tbilisi-processor.json | - | ⚠️ Нет ноды | Добавить ноду |
| batumi-processor.json | - | ⚠️ Нет ноды | Добавить ноду |
| kutaisi-processor.json | - | ⚠️ Нет ноды | Добавить ноду |
| service-center-processor.json | - | ⚠️ Нет ноды | Добавить ноду |

### Postgres ноды (напрямую обновляют БД)

| Workflow | Нода | Статус | Действие |
|----------|------|--------|----------|
| rentprog-cars-snapshot.json | Upsert Cars to PostgreSQL | ⚠️ Требует триггер | Обновить триггер |
| rentprog-events-scraper.json | UPDATE cars | ⚠️ Требует обновления | Добавить поля в SQL |

---

## 🚀 Приоритеты

### P0 (Критично - сделать сейчас)
1. ✅ Импортировать обновленные workflow (2 файла)
2. ⚠️ Обновить processor workflows (4 файла) - добавить ноды HTTP Request

### P1 (Важно - на этой неделе)
3. ⚠️ Обновить триггер `sync_cars_from_snapshot_trigger`
4. ⚠️ Обновить history parser workflows

---

## 📝 Следующие шаги

1. **Импортировать обновленные workflow:**
   ```bash
   node setup/import_workflow_2025.mjs n8n-workflows/rentprog-upsert-processor.json
   node setup/import_workflow_2025.mjs n8n-workflows/rentprog-events-auto-processor.json
   ```

2. **Обновить processor workflows вручную:**
   - Открыть в n8n UI
   - Добавить ноду HTTP Request
   - Настроить как в примере

3. **Создать миграцию для триггера:**
   - Файл: `setup/migrations/022_update_snapshot_trigger_change_tracking.sql`
   - Обновить функцию `sync_cars_from_snapshot()`

---

## 🔗 Документация

- `docs/CHANGE_TRACKING_IMPLEMENTATION.md` - Общая документация
- `docs/WORKFLOWS_TO_UPDATE_CHANGE_TRACKING.md` - Детальный список
- `docs/WORKFLOWS_UPDATE_INSTRUCTIONS.md` - Пошаговые инструкции

