# Руководство: Обновление workflow для отслеживания источника изменений

**Дата:** 2025-01-20

---

## 📋 Сводка

### ✅ Уже обновлено в файлах

1. **rentprog-events-auto-processor.json** - добавлены headers ✅
2. **rentprog-upsert-processor.json** - требует ручного обновления (файл не сохранился)

### ⚠️ Требуют обновления

3. **Processor Workflows** (4 филиала) - добавить ноды HTTP Request
4. **Snapshot Workflows** - обновить триггер
5. **History Parser Workflows** - добавить headers или поля в SQL

---

## 🔧 Детальные инструкции

### 1. RentProg Upsert Processor

**Файл:** `n8n-workflows/rentprog-upsert-processor.json`  
**Нода:** "Process Event via Jarvis" (ID: `process-event-node`)

**Что добавить в ноду:**

В параметрах ноды добавить:

```json
"sendHeaders": true,
"headerParameters": {
  "parameters": [
    {
      "name": "X-Source",
      "value": "n8n_workflow"
    },
    {
      "name": "X-Workflow-Id",
      "value": "={{ $workflow.id }}"
    },
    {
      "name": "X-Workflow-Name",
      "value": "={{ $workflow.name }}"
    },
    {
      "name": "X-Execution-Id",
      "value": "={{ $execution.id }}"
    }
  ]
}
```

И добавить в body:
```json
{
  "name": "eventId",
  "value": "={{ $json.id }}"
}
```

**Где:** После `"url"` и перед `"sendBody"`

---

### 2. Processor Workflows (Tbilisi, Batumi, Kutaisi, Service Center)

**Workflow:**
- Tbilisi Processor Rentprog
- Batumi Processor Rentprog  
- Kutaisi Processor Rentprog
- Service Center Processor Rentprog

**Шаги:**

1. **Открыть workflow в n8n UI**
2. **Найти ноду "Save to Events"** (Postgres)
3. **Добавить новую ноду HTTP Request** после неё
4. **Настроить ноду:**

**Параметры:**

| Поле | Значение |
|------|----------|
| **Название** | Process Event via Jarvis |
| **Тип** | HTTP Request |
| **Method** | POST |
| **URL** | `={{ $env.ORCHESTRATOR_URL || 'http://46.224.17.15:3000' }}/process-event` |

**Headers (вкладка "Headers"):**

| Name | Value |
|------|-------|
| `X-Source` | `n8n_workflow` |
| `X-Workflow-Id` | `={{ $workflow.id }}` |
| `X-Workflow-Name` | `={{ $workflow.name }}` |
| `X-Execution-Id` | `={{ $execution.id }}` |

**Body (вкладка "Body"):**

| Name | Value |
|------|-------|
| `branch` | `={{ $('Parse Webhook').item.json.metadata.branch || 'tbilisi' }}` |
| `type` | `={{ $('Parse Webhook').item.json.event_name }}` |
| `rentprog_id` | `={{ $('Parse Webhook').item.json.rentprog_id }}` |
| `eventId` | `={{ $('Save to Events').item.json.id }}` |

**Options:**
- Timeout: 30000
- Retry On Fail: ✅
- Max Tries: 2
- Continue On Fail: ✅

**Подключение:**
- "Save to Events" → "Process Event via Jarvis" → следующая нода

---

### 3. Snapshot Workflows

**Workflow:**
- RentProg Cars Snapshot
- RentProg Cars Snapshot Parallel
- RentProg Car Prices Daily

**Проблема:** Эти workflow вставляют данные в `rentprog_car_states_snapshot`, затем триггер синхронизирует в `cars`.

**Решение:** Обновить триггер БД (см. миграцию ниже)

---

### 4. History Parser Workflows

**Workflow:**
- RentProg Events Scraper
- History Matcher Processor

**Если workflow вызывает Jarvis API:**
- Добавить headers (как в пункте 1-2)

**Если workflow напрямую обновляет БД:**
- Добавить поля в UPDATE запросы:

```sql
UPDATE cars SET
  price_hour = $1,
  updated_by_source = 'rentprog_history',
  updated_by_workflow = '={{ $workflow.name }}',
  updated_by_execution_id = '={{ $execution.id }}',
  updated_by_function = 'history_parser',
  updated_at = NOW()
WHERE rentprog_id = $2;
```

---

## 🔧 Обновление триггера

**Файл:** `setup/migrations/022_update_snapshot_trigger_change_tracking.sql`

```sql
CREATE OR REPLACE FUNCTION sync_cars_from_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  car_uuid UUID;
BEGIN
  -- ... существующий код ...
  
  -- При UPDATE в cars устанавливаем источник
  UPDATE cars SET
    -- ... существующие поля ...
    updated_by_source = 'snapshot_workflow',
    updated_by_workflow = 'RentProg Cars Snapshot',
    updated_by_function = 'sync_cars_from_snapshot',
    updated_by_metadata = jsonb_build_object(
      'snapshot_id', NEW.rentprog_id,
      'fetched_at', NEW.fetched_at
    ),
    updated_at = NOW()
  WHERE rentprog_id = NEW.rentprog_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 📊 Итоговая таблица

| # | Workflow | Нода | Действие | Статус |
|---|----------|------|----------|--------|
| 1 | RentProg Upsert Processor | Process Event via Jarvis | Добавить headers | ⚠️ Требует обновления |
| 2 | RentProg Events Auto Processor | Process Event via Jarvis | Добавить headers | ✅ Обновлено |
| 3 | Tbilisi Processor | - | Добавить HTTP Request | ⚠️ Требует обновления |
| 4 | Batumi Processor | - | Добавить HTTP Request | ⚠️ Требует обновления |
| 5 | Kutaisi Processor | - | Добавить HTTP Request | ⚠️ Требует обновления |
| 6 | Service Center Processor | - | Добавить HTTP Request | ⚠️ Требует обновления |
| 7 | Snapshot Workflows | - | Обновить триггер | ⚠️ Требует миграции |
| 8 | History Parser | - | Добавить headers/SQL | ⚠️ Требует обновления |

---

## 🚀 Приоритеты

### P0 (Сделать сейчас)
1. Обновить `rentprog-upsert-processor.json` - добавить headers вручную
2. Обновить processor workflows (4 файла) - добавить ноды HTTP Request

### P1 (На этой неделе)
3. Обновить триггер `sync_cars_from_snapshot_trigger`
4. Обновить history parser workflows

---

## 📝 Быстрая справка

### Headers для HTTP Request нод:
```
X-Source: n8n_workflow
X-Workflow-Id: ={{ $workflow.id }}
X-Workflow-Name: ={{ $workflow.name }}
X-Execution-Id: ={{ $execution.id }}
```

### Поля для SQL UPDATE:
```sql
updated_by_source = 'n8n_workflow',
updated_by_workflow = '={{ $workflow.name }}',
updated_by_execution_id = '={{ $execution.id }}'
```

---

## 🔗 Документация

- `docs/CHANGE_TRACKING_IMPLEMENTATION.md` - Общая документация
- `docs/WORKFLOWS_UPDATE_CHECKLIST.md` - Чеклист
- `docs/WORKFLOWS_UPDATE_INSTRUCTIONS.md` - Пошаговые инструкции
- `docs/WORKFLOWS_UPDATE_SUMMARY.md` - Сводка

