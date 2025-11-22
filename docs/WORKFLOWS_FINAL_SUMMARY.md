# Итоговая сводка: Workflow для обновления

**Дата:** 2025-01-20

---

## ✅ Уже обновлено в файлах

### 1. RentProg Upsert Processor ✅
- **Файл:** `n8n-workflows/rentprog-upsert-processor.json`
- **Нода:** "Process Event via Jarvis"
- **Headers добавлены:** ✅
- **Статус:** Готово к импорту

### 2. RentProg Events Auto Processor ✅
- **Файл:** `n8n-workflows/rentprog-events-auto-processor.json`
- **Нода:** "Process Event via Jarvis"
- **Headers добавлены:** ✅
- **Статус:** Готово к импорту

---

## ⚠️ Требуют обновления в n8n UI

### 3. Processor Workflows (4 филиала)

**Workflow:**
- Tbilisi Processor Rentprog
- Batumi Processor Rentprog
- Kutaisi Processor Rentprog
- Service Center Processor Rentprog

**Что сделать:**
1. Открыть workflow в n8n UI
2. Найти ноду "Save to Events" (Postgres)
3. Добавить новую ноду HTTP Request после неё
4. Настроить как в примере ниже

**Пример настройки ноды HTTP Request:**

```
Название: Process Event via Jarvis
Тип: HTTP Request
Method: POST
URL: ={{ $env.ORCHESTRATOR_URL || 'http://46.224.17.15:3000' }}/process-event

Headers:
  X-Source: n8n_workflow
  X-Workflow-Id: ={{ $workflow.id }}
  X-Workflow-Name: ={{ $workflow.name }}
  X-Execution-Id: ={{ $execution.id }}

Body:
  branch: ={{ $('Parse Webhook').item.json.metadata.branch || 'tbilisi' }}
  type: ={{ $('Parse Webhook').item.json.event_name }}
  rentprog_id: ={{ $('Parse Webhook').item.json.rentprog_id }}
  eventId: ={{ $('Save to Events').item.json.id }}
```

**Подключение:**
- "Save to Events" → "Process Event via Jarvis" → следующая нода

---

### 4. Snapshot Workflows

**Workflow:**
- RentProg Cars Snapshot
- RentProg Cars Snapshot Parallel
- RentProg Car Prices Daily

**Проблема:** Эти workflow напрямую обновляют БД через триггер.

**Решение:** Обновить триггер `sync_cars_from_snapshot_trigger` (требует миграцию)

---

## 📋 Быстрая справка

### Какие ноды обновлять?

**HTTP Request ноды, которые вызывают:**
- `/process-event` → добавить headers
- `/upsert-car` → добавить headers

**Postgres ноды, которые делают:**
- `UPDATE cars` → добавить поля `updated_by_*` в SQL
- `INSERT INTO cars` → добавить поля `updated_by_*` в SQL

### Какие headers добавлять?

```
X-Source: n8n_workflow
X-Workflow-Id: ={{ $workflow.id }}
X-Workflow-Name: ={{ $workflow.name }}
X-Execution-Id: ={{ $execution.id }}
```

### Какие поля добавлять в SQL?

```sql
updated_by_source = 'n8n_workflow',
updated_by_workflow = '={{ $workflow.name }}',
updated_by_execution_id = '={{ $execution.id }}',
updated_by_function = 'workflow_postgres_node'
```

---

## 🔗 Документация

- `docs/CHANGE_TRACKING_IMPLEMENTATION.md` - Общая документация
- `docs/WORKFLOWS_UPDATE_CHECKLIST.md` - Чеклист
- `docs/WORKFLOWS_UPDATE_INSTRUCTIONS.md` - Пошаговые инструкции

