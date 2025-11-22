# Инструкция по обновлению workflow для отслеживания источника изменений

**Дата:** 2025-01-20  
**Статус:** ✅ Частично выполнено

---

## ✅ Уже обновлено автоматически

1. **rentprog-upsert-processor.json** - добавлены headers в ноду "Process Event via Jarvis"
2. **rentprog-events-auto-processor.json** - добавлены headers в ноду "Process Event via Jarvis"

---

## 📋 Workflow, требующие ручного обновления

### 1. Processor Workflows (Tbilisi, Batumi, Kutaisi, Service Center)

**Файлы:**
- `n8n-workflows/tbilisi-processor.json`
- `n8n-workflows/batumi-processor.json`
- `n8n-workflows/kutaisi-processor.json`
- `n8n-workflows/service-center-processor.json`

**Проблема:** Эти workflow напрямую обновляют БД через Postgres, НЕ через Jarvis API.

**Решение:** Добавить ноду HTTP Request после "Save to Events" для вызова Jarvis API.

#### Шаги:

1. **Найти ноду "Save to Events"** (Postgres)
2. **Добавить новую ноду HTTP Request** после неё
3. **Настроить ноду:**

```json
{
  "parameters": {
    "method": "POST",
    "url": "={{ $env.ORCHESTRATOR_URL || 'http://46.224.17.15:3000' }}/process-event",
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
    },
    "sendBody": true,
    "bodyParameters": {
      "parameters": [
        {
          "name": "branch",
          "value": "={{ $('Parse Webhook').item.json.metadata.branch || 'tbilisi' }}"
        },
        {
          "name": "type",
          "value": "={{ $('Parse Webhook').item.json.event_name }}"
        },
        {
          "name": "rentprog_id",
          "value": "={{ $('Parse Webhook').item.json.rentprog_id }}"
        },
        {
          "name": "eventId",
          "value": "={{ $('Save to Events').item.json.id }}"
        }
      ]
    },
    "options": {
      "timeout": 30000,
      "response": {
        "response": {
          "responseFormat": "json"
        }
      }
    },
    "retryOnFail": true,
    "maxTries": 2,
    "continueOnFail": true
  },
  "name": "Process Event via Jarvis",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [1050, 400],
  "onError": "continueRegularOutput"
}
```

4. **Подключить ноду:**
   - "Save to Events" → "Process Event via Jarvis"
   - "Process Event via Jarvis" → следующая нода (если есть)

---

### 2. Snapshot Workflows

**Файлы:**
- `n8n-workflows/rentprog-cars-snapshot.json`
- `n8n-workflows/rentprog-cars-snapshot-parallel.json`
- `n8n-workflows/rentprog-cars-snapshot-updated.json`
- `n8n-workflows/rentprog-car-prices-daily.json`

**Проблема:** Эти workflow напрямую вставляют данные в `rentprog_car_states_snapshot`, затем триггер синхронизирует в `cars`.

**Решение:** Обновить триггер `sync_cars_from_snapshot_trigger` для сохранения источника.

#### Шаги:

1. **Выполнить миграцию для обновления триггера:**

```sql
-- Файл: setup/migrations/022_update_snapshot_trigger_change_tracking.sql

CREATE OR REPLACE FUNCTION sync_cars_from_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  car_uuid UUID;
BEGIN
  -- ... существующий код поиска/создания car_uuid ...
  
  -- При UPDATE в cars устанавливаем источник
  UPDATE cars SET
    -- ... существующие поля ...
    updated_by_source = 'snapshot_workflow',
    updated_by_workflow = 'RentProg Cars Snapshot',
    updated_by_function = 'sync_cars_from_snapshot',
    updated_by_execution_id = NULL, -- Можно добавить через metadata если нужно
    updated_by_metadata = jsonb_build_object(
      'snapshot_id', NEW.rentprog_id,
      'fetched_at', NEW.fetched_at,
      'branch_id', NEW.branch_id
    ),
    updated_at = NOW()
  WHERE rentprog_id = NEW.rentprog_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

2. **Или добавить вызов Jarvis API в workflow:**

После ноды "Save Snapshot" добавить ноду HTTP Request для каждого автомобиля:

```json
{
  "parameters": {
    "method": "POST",
    "url": "={{ $env.ORCHESTRATOR_URL || 'http://46.224.17.15:3000' }}/process-event",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "X-Source",
          "value": "snapshot_workflow"
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
    },
    "sendBody": true,
    "bodyParameters": {
      "parameters": [
        {
          "name": "branch",
          "value": "={{ $json.branch }}"
        },
        {
          "name": "type",
          "value": "car_update"
        },
        {
          "name": "rentprog_id",
          "value": "={{ $json.rentprog_id }}"
        }
      ]
    }
  },
  "name": "Process Car Update",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2
}
```

---

### 3. History Parser Workflows

**Файлы:**
- `n8n-workflows/rentprog-events-scraper.json`
- `n8n-workflows/history-matcher-processor.json`

**Проблема:** Эти workflow парсят историю RentProg и могут обновлять БД.

**Решение:** Если workflow вызывает Jarvis API - добавить headers (как в пункте 1).  
Если напрямую обновляет БД - добавить поля в UPDATE запросы.

#### Пример для Postgres ноды:

```sql
UPDATE cars SET
  price_hour = $1,
  updated_by_source = 'rentprog_history',
  updated_by_workflow = '={{ $workflow.name }}',
  updated_by_execution_id = '={{ $execution.id }}',
  updated_by_metadata = jsonb_build_object(
    'history_id', $2,
    'parsed_at', NOW()
  ),
  updated_at = NOW()
WHERE rentprog_id = $3;
```

---

## 🔍 Как найти ноды для обновления

### В n8n UI:

1. Откройте workflow
2. Найдите ноды типа **HTTP Request**
3. Проверьте URL - должен содержать `/process-event` или `/upsert-car`
4. Если нет headers - добавьте их

### В JSON файле:

Ищите ноды с:
```json
{
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "url": ".../process-event"
  }
}
```

---

## 📝 Чеклист обновления

### HTTP Request ноды (вызывают Jarvis API)

- [x] `rentprog-upsert-processor.json` → нода "Process Event via Jarvis" ✅
- [x] `rentprog-events-auto-processor.json` → нода "Process Event via Jarvis" ✅
- [ ] `tbilisi-processor.json` → добавить ноду HTTP Request
- [ ] `batumi-processor.json` → добавить ноду HTTP Request
- [ ] `kutaisi-processor.json` → добавить ноду HTTP Request
- [ ] `service-center-processor.json` → добавить ноду HTTP Request

### Postgres ноды (напрямую обновляют БД)

- [ ] `rentprog-cars-snapshot.json` → обновить триггер или добавить HTTP Request
- [ ] `rentprog-cars-snapshot-parallel.json` → обновить триггер или добавить HTTP Request
- [ ] `rentprog-events-scraper.json` → обновить UPDATE запросы
- [ ] `history-matcher-processor.json` → обновить UPDATE запросы

### Триггеры БД

- [ ] `sync_cars_from_snapshot_trigger` → добавить установку полей источника
- [ ] `process_booking_nested_entities_trigger` → добавить установку полей источника

---

## 🚀 Быстрый старт

### Шаг 1: Проверить обновленные workflow

```bash
# Проверить, что headers добавлены
node setup/check_workflow_headers.mjs
```

### Шаг 2: Импортировать обновленные workflow

```bash
# Импортировать через MCP
# Или вручную через n8n UI
```

### Шаг 3: Обновить processor workflows

1. Открыть `tbilisi-processor.json` в n8n
2. Добавить ноду HTTP Request после "Save to Events"
3. Настроить как в примере выше
4. Повторить для других processor workflows

### Шаг 4: Обновить триггеры

```bash
# Выполнить миграцию
node setup/migrations/022_update_snapshot_trigger_change_tracking.mjs
```

---

## 📊 Проверка после обновления

```sql
-- Проверить, что новые изменения имеют источник
SELECT 
  plate,
  price_hour,
  updated_by_source,
  updated_by_workflow,
  updated_by_execution_id,
  updated_at
FROM cars
WHERE updated_at >= NOW() - INTERVAL '1 hour'
  AND updated_by_source IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;
```

Все записи должны иметь заполненные поля `updated_by_*`.

---

## 🔗 Связанные файлы

- `docs/CHANGE_TRACKING_IMPLEMENTATION.md` - Общая документация
- `docs/WORKFLOWS_TO_UPDATE_CHANGE_TRACKING.md` - Список workflow
- `setup/migrations/021_add_change_tracking_fields.sql` - Миграция полей
- `setup/update_workflows_change_tracking.mjs` - Скрипт автоматического обновления

