# Workflow для обновления: Отслеживание источника изменений

**Дата:** 2025-01-20  
**Статус:** 📋 Требуется обновление

---

## 🎯 Цель

Добавить headers в HTTP Request ноды, которые вызывают Jarvis API, чтобы отслеживать источник изменений в БД.

---

## 📋 Workflow для обновления

### 1. ✅ RentProg Upsert Processor

**Файл:** `n8n-workflows/rentprog-upsert-processor.json`  
**ID ноды:** `process-event-node`  
**Тип ноды:** HTTP Request

**Что добавить:**

В ноде **"Process Event via Jarvis"** добавить в `parameters.headers`:

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
          "value": "={{ $json.branch }}"
        },
        {
          "name": "type",
          "value": "={{ $json.type }}"
        },
        {
          "name": "rentprog_id",
          "value": "={{ $json.rentprog_id }}"
        },
        {
          "name": "eventId",
          "value": "={{ $json.id }}"
        }
      ]
    }
  }
}
```

---

### 2. ✅ RentProg Events Auto Processor

**Файл:** `n8n-workflows/rentprog-events-auto-processor.json`  
**ID ноды:** `process-event`  
**Тип ноды:** HTTP Request

**Что добавить:**

В ноде **"Process Event via Jarvis"** добавить `sendHeaders: true` и `headerParameters`:

```json
{
  "parameters": {
    "method": "POST",
    "url": "={{ $env.JARVIS_API_URL || 'http://46.224.17.15:3000' }}/process-event",
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
          "value": "={{ $json.branch }}"
        },
        {
          "name": "type",
          "value": "={{ $json.type }}"
        },
        {
          "name": "ext_id",
          "value": "={{ $json.ext_id }}"
        },
        {
          "name": "rentprog_id",
          "value": "={{ $json.rentprog_id }}"
        },
        {
          "name": "eventId",
          "value": "={{ $json.eventId }}"
        }
      ]
    }
  }
}
```

---

### 3. ⚠️ Processor Workflows (Tbilisi, Batumi, Kutaisi, Service Center)

**Файлы:**
- `n8n-workflows/tbilisi-processor.json`
- `n8n-workflows/batumi-processor.json`
- `n8n-workflows/kutaisi-processor.json`
- `n8n-workflows/service-center-processor.json`

**Особенность:** Эти workflow напрямую обновляют БД через Postgres, НЕ через Jarvis API.

**Варианты решения:**

#### Вариант A: Добавить вызов Jarvis API (рекомендуется)

Добавить ноду HTTP Request после "Save to Events" для вызова `/process-event`:

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
          "value": "={{ $json.metadata.branch || 'tbilisi' }}"
        },
        {
          "name": "type",
          "value": "={{ $json.event_name }}"
        },
        {
          "name": "rentprog_id",
          "value": "={{ $json.rentprog_id }}"
        },
        {
          "name": "eventId",
          "value": "={{ $json.id }}"
        }
      ]
    }
  },
  "name": "Process Event via Jarvis",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2
}
```

#### Вариант B: Обновить Postgres запросы напрямую

Если workflow напрямую обновляет БД, нужно добавить поля в UPDATE запросы:

```sql
UPDATE cars SET
  ...,
  updated_by_source = 'n8n_workflow',
  updated_by_workflow = 'Tbilisi Processor Rentprog',
  updated_by_execution_id = '{{ $execution.id }}',
  updated_at = NOW()
WHERE ...
```

---

### 4. ⚠️ Snapshot Workflows

**Файлы:**
- `n8n-workflows/rentprog-cars-snapshot.json`
- `n8n-workflows/rentprog-cars-snapshot-parallel.json`
- `n8n-workflows/rentprog-cars-snapshot-updated.json`

**Особенность:** Эти workflow напрямую вставляют данные в `rentprog_car_states_snapshot` через Postgres.

**Что сделать:**

Обновить ноду **"Save Snapshot"** (Postgres) - добавить поля в INSERT запрос:

```sql
INSERT INTO rentprog_car_states_snapshot AS tgt (
  branch_id, rentprog_id, car_name, code, number, vin, color, year, transmission,
  fuel, car_type, car_class, active, state, tank_state, clean_state, mileage,
  tire_type, tire_size, last_inspection, deposit, price_hour, hourly_deposit,
  monthly_deposit, investor_id, purchase_price, purchase_date, age_limit,
  driver_year_limit, franchise, max_fine, repair_cost, is_air, climate_control,
  parktronic, parktronic_camera, heated_seats, audio_system, usb_system,
  rain_sensor, engine_capacity, number_doors, tank_value, pts,
  registration_certificate, body_number, data
)
SELECT
  rec.branch_id, rec.rentprog_id, rec.car_name, rec.code, rec.number, rec.vin, rec.color, rec.year, rec.transmission,
  rec.fuel, rec.car_type, rec.car_class, rec.active, rec.state, rec.tank_state, rec.clean_state, rec.mileage,
  rec.tire_type, rec.tire_size, rec.last_inspection, rec.deposit, rec.price_hour, rec.hourly_deposit,
  rec.monthly_deposit, rec.investor_id, rec.purchase_price, rec.purchase_date, rec.age_limit,
  rec.driver_year_limit, rec.franchise, rec.max_fine, rec.repair_cost, rec.is_air, rec.climate_control,
  rec.parktronic, rec.parktronic_camera, rec.heated_seats, rec.audio_system, rec.usb_system,
  rec.rain_sensor, rec.engine_capacity, rec.number_doors, rec.tank_value, rec.pts,
  rec.registration_certificate, rec.body_number, rec.data
FROM json_populate_record(NULL::rentprog_car_states_snapshot, {{ JSON.stringify($json) }}) AS rec
ON CONFLICT (rentprog_id) DO UPDATE SET
  ...,
  -- НЕ обновляем updated_by_* в snapshot, т.к. это снимок, а не основная таблица
  data = COALESCE(EXCLUDED.data, tgt.data);
```

**Важно:** Для snapshot workflows нужно обновить **триггер**, который синхронизирует данные из snapshot в таблицу `cars`. Триггер должен сохранять источник.

---

### 5. ⚠️ History Parser Workflows

**Файлы:**
- `n8n-workflows/rentprog-events-scraper.json`
- `n8n-workflows/history-matcher-processor.json`

**Особенность:** Эти workflow парсят историю RentProg и могут обновлять БД.

**Что сделать:**

Если workflow вызывает Jarvis API - добавить headers (как в пункте 1-2).  
Если напрямую обновляет БД - добавить поля в UPDATE запросы (как в пункте 3, вариант B).

---

## 🔧 Триггеры БД

### Триггер `sync_cars_from_snapshot_trigger`

**Файл:** `setup/migrations/019_sync_cars_from_snapshot_trigger.sql`

**Что обновить:**

В функции `sync_cars_from_snapshot()` добавить установку полей источника:

```sql
CREATE OR REPLACE FUNCTION sync_cars_from_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  -- ... существующий код ...
  
  -- При UPDATE в cars устанавливаем источник
  UPDATE cars SET
    ...,
    updated_by_source = 'snapshot_workflow',
    updated_by_workflow = 'RentProg Cars Snapshot',
    updated_by_function = 'sync_cars_from_snapshot',
    updated_by_metadata = jsonb_build_object(
      'snapshot_id', NEW.rentprog_id,
      'fetched_at', NEW.fetched_at
    ),
    updated_at = NOW()
  WHERE rentprog_id = NEW.rentprog_id;
  
  -- ... остальной код ...
END;
$$ LANGUAGE plpgsql;
```

---

## 📝 Чеклист обновления

### HTTP Request ноды (вызывают Jarvis API)

- [ ] `rentprog-upsert-processor.json` → нода "Process Event via Jarvis"
- [ ] `rentprog-events-auto-processor.json` → нода "Process Event via Jarvis"
- [ ] Добавить `sendHeaders: true`
- [ ] Добавить `headerParameters` с:
  - `X-Source: n8n_workflow`
  - `X-Workflow-Id: ={{ $workflow.id }}`
  - `X-Workflow-Name: ={{ $workflow.name }}`
  - `X-Execution-Id: ={{ $execution.id }}`

### Postgres ноды (напрямую обновляют БД)

- [ ] `tbilisi-processor.json` → ноды UPDATE/INSERT в cars
- [ ] `batumi-processor.json` → ноды UPDATE/INSERT в cars
- [ ] `kutaisi-processor.json` → ноды UPDATE/INSERT в cars
- [ ] `service-center-processor.json` → ноды UPDATE/INSERT в cars
- [ ] Добавить поля в UPDATE запросы:
  - `updated_by_source = 'n8n_workflow'`
  - `updated_by_workflow = '{{ $workflow.name }}'`
  - `updated_by_execution_id = '{{ $execution.id }}'`

### Триггеры БД

- [ ] `sync_cars_from_snapshot_trigger` → добавить установку полей источника
- [ ] `process_booking_nested_entities_trigger` → добавить установку полей источника

---

## 🚀 Быстрый старт

### Шаг 1: Обновить основные workflow

1. Открыть `rentprog-upsert-processor.json` в n8n
2. Найти ноду "Process Event via Jarvis"
3. Добавить headers (см. пример выше)
4. Сохранить и активировать

### Шаг 2: Обновить processor workflows

1. Открыть `tbilisi-processor.json` (и аналогичные)
2. Добавить ноду HTTP Request после "Save to Events"
3. Или обновить Postgres запросы напрямую

### Шаг 3: Обновить триггеры

1. Выполнить миграцию для обновления триггеров
2. Проверить, что поля сохраняются корректно

---

## 📊 Проверка

После обновления проверить:

```sql
SELECT 
  plate,
  price_hour,
  updated_by_source,
  updated_by_workflow,
  updated_by_execution_id,
  updated_at
FROM cars
WHERE updated_at >= NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC
LIMIT 10;
```

Все записи должны иметь заполненные поля `updated_by_*`.

---

## 🔗 Связанные файлы

- `docs/CHANGE_TRACKING_IMPLEMENTATION.md` - Общая документация
- `setup/migrations/021_add_change_tracking_fields.sql` - Миграция
- `src/api/index.ts` - API endpoint (уже обновлен)
- `src/db/upsert.ts` - Функции upsert (уже обновлены)

