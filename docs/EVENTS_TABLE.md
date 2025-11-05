# Таблица events

**Дата обновления:** 2025-11-04  
**Статус:** ✅ Актуальна

---

## Назначение

Хранение всех событий (вебхуков) от RentProg для последующей обработки.

---

## Структура таблицы

```sql
CREATE TABLE events (
  -- Идентификация
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_hash TEXT,                         -- Hash для дедупликации
  
  -- Классификация события
  type TEXT,                               -- Короткий тип (car_update, booking_create)
  event_name TEXT,                         -- 🆕 Полное название события
  entity_type TEXT,                        -- 🆕 Тип сущности: car | client | booking
  operation TEXT,                          -- 🆕 Операция: create | update | delete
  
  -- Связь с RentProg
  rentprog_id TEXT,                        -- ID сущности в RentProg (38204)
  company_id INTEGER,                      -- ID компании/филиала (9247, 9248, 9506, 11163)
  ext_id TEXT,                             -- Дополнительный внешний ID
  
  -- Данные события
  payload JSONB,                           -- 🆕 Полное JSON тело вебхука
  metadata JSONB,                          -- 🆕 Дополнительные метаданные
  
  -- Статус обработки
  processed BOOLEAN DEFAULT FALSE,         -- Обработано ли событие
  ok BOOLEAN DEFAULT TRUE,                 -- Успешно ли обработано
  reason TEXT                              -- Причина ошибки (если ok = false)
);
```

---

## Индексы

```sql
-- Основные индексы
CREATE UNIQUE INDEX events_pkey ON events(id);
CREATE UNIQUE INDEX events_company_id_type_rentprog_id_unique 
  ON events(company_id, type, rentprog_id);

-- Индексы для фильтрации
CREATE INDEX idx_events_ts ON events(ts);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_entity_type ON events(entity_type);
CREATE INDEX idx_events_operation ON events(operation);
CREATE INDEX idx_events_event_name ON events(event_name);
CREATE INDEX idx_events_rentprog_id ON events(rentprog_id);
CREATE INDEX idx_events_company_id ON events(company_id);

-- Индексы для необработанных событий
CREATE INDEX idx_events_processed ON events(processed) 
  WHERE processed = false;

-- Индексы для дедупликации
CREATE INDEX idx_events_hash ON events(event_hash) 
  WHERE event_hash IS NOT NULL;

-- GIN индексы для JSONB поиска
CREATE INDEX idx_events_payload_gin ON events USING gin(payload);
CREATE INDEX idx_events_metadata_gin ON events USING gin(metadata);
```

---

## Поля (подробное описание)

### Идентификация

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | BIGSERIAL | Primary Key, автоинкремент |
| `ts` | TIMESTAMPTZ | Время получения события |
| `event_hash` | TEXT | MD5/SHA256 hash для дедупликации |

### Классификация

| Поле | Тип | Описание | Пример |
|------|-----|----------|--------|
| `type` | TEXT | Короткий тип события | `car_update`, `booking_create` |
| `event_name` | TEXT | 🆕 Полное название события | `car_update`, `booking.issue.planned` |
| `entity_type` | TEXT | 🆕 Тип сущности | `car`, `client`, `booking` |
| `operation` | TEXT | 🆕 Тип операции | `create`, `update`, `destroy` |

### Связь с RentProg

| Поле | Тип | Описание | Пример |
|------|-----|----------|--------|
| `rentprog_id` | TEXT | ID сущности в RentProg | `38204`, `501190` |
| `company_id` | INTEGER | ID компании/филиала | `9247`, `9248`, `9506`, `11163` |
| `ext_id` | TEXT | Дополнительный ID | (legacy) |

### Данные

| Поле | Тип | Описание |
|------|-----|----------|
| `payload` | JSONB | 🆕 **Полное JSON тело вебхука от RentProg** |
| `metadata` | JSONB | 🆕 **Дополнительные метаданные** (branch, user_id, timestamp) |

### Обработка

| Поле | Тип | Описание |
|------|-----|----------|
| `processed` | BOOLEAN | Обработано ли событие (default: false) |
| `ok` | BOOLEAN | Успешно ли обработано (default: true) |
| `reason` | TEXT | Причина ошибки при обработке |

---

## Примеры использования

### 1. Вставка события из вебхука

```sql
INSERT INTO events (
  type, 
  event_name,
  entity_type,
  operation,
  rentprog_id, 
  company_id,
  payload,
  metadata,
  event_hash
) VALUES (
  'car_update',                    -- короткий тип
  'car_update',                    -- полное название
  'car',                           -- тип сущности
  'update',                        -- операция
  '38204',                         -- ID машины
  9247,                            -- Tbilisi
  '{
    "id": 38204,
    "mileage": [101191, 102035],
    "company_id": 9247
  }'::jsonb,                       -- полный payload
  '{
    "source": "webhook",
    "received_at": "2025-11-04T05:00:00Z",
    "user_agent": "RentProg/1.0"
  }'::jsonb,                       -- метаданные
  md5('9247_car_update_38204')    -- hash для дедупликации
)
ON CONFLICT (company_id, type, rentprog_id) DO NOTHING;
```

### 2. Получение необработанных событий

```sql
SELECT 
  id,
  ts,
  event_name,
  entity_type,
  operation,
  rentprog_id,
  company_id,
  payload
FROM events
WHERE processed = false
ORDER BY ts ASC
LIMIT 50;
```

### 3. Получение событий по филиалу

```sql
SELECT 
  e.*,
  b.code AS branch_code,
  b.name AS branch_name
FROM events e
LEFT JOIN branches b ON b.company_id = e.company_id
WHERE e.company_id = 9247  -- Tbilisi
  AND e.ts > NOW() - INTERVAL '24 hours'
ORDER BY e.ts DESC;
```

### 4. Поиск по JSON payload

```sql
-- Найти все события где изменился пробег
SELECT 
  rentprog_id,
  payload->>'mileage' AS mileage_change
FROM events
WHERE payload @> '{"mileage": []}'::jsonb
  AND jsonb_array_length(payload->'mileage') = 2;

-- Найти события с конкретным значением
SELECT *
FROM events
WHERE payload @> '{"status": "active"}'::jsonb;
```

### 5. Статистика событий

```sql
-- События по типам за последние 24 часа
SELECT 
  entity_type,
  operation,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE processed = true) AS processed_count,
  COUNT(*) FILTER (WHERE ok = false) AS errors
FROM events
WHERE ts > NOW() - INTERVAL '24 hours'
GROUP BY entity_type, operation
ORDER BY total DESC;
```

### 6. События по филиалам

```sql
SELECT 
  b.name AS branch,
  COUNT(*) AS total_events,
  COUNT(*) FILTER (WHERE e.entity_type = 'car') AS car_events,
  COUNT(*) FILTER (WHERE e.entity_type = 'booking') AS booking_events,
  COUNT(*) FILTER (WHERE e.entity_type = 'client') AS client_events
FROM events e
LEFT JOIN branches b ON b.company_id = e.company_id
WHERE e.ts > NOW() - INTERVAL '7 days'
GROUP BY b.name
ORDER BY total_events DESC;
```

---

## Workflow обработки событий

### 1. Получение вебхука (n8n: RentProg Webhooks Monitor)

```javascript
// Parse & Validate Format (Code node)
const parsed = {
  event_name: $json.body.event || $json.event,
  payload: $json.body.payload || $json.payload,
  rentprog_id: extractedId,
  company_id: extractedCompanyId,
  entity_type: determineEntityType(event_name),
  operation: determineOperation(event_name)
};
```

### 2. Сохранение в БД (Save Event)

```sql
INSERT INTO events (
  event_name,
  entity_type,
  operation,
  rentprog_id,
  company_id,
  payload,
  metadata,
  event_hash,
  processed
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, false
)
ON CONFLICT (company_id, type, rentprog_id) DO NOTHING
RETURNING id;
```

### 3. Обработка (n8n: RentProg Upsert Processor)

```javascript
// Получить необработанные события
SELECT * FROM events 
WHERE processed = false 
LIMIT 50;

// Обработать каждое событие
// ... вызов Jarvis API /process-event

// Обновить статус
UPDATE events 
SET processed = true, ok = true, reason = null
WHERE id = $1;
```

---

## Миграция (2025-11-04)

### Добавленные поля

**Скрипт:** `setup/add_webhook_fields_to_events.mjs`

**Новые поля:**
1. `payload` (JSONB) - полное JSON тело вебхука
2. `operation` (TEXT) - create/update/destroy
3. `entity_type` (TEXT) - car/client/booking
4. `event_name` (TEXT) - полное название события
5. `metadata` (JSONB) - дополнительные метаданные

**Новые индексы:**
- `idx_events_payload_gin` - GIN индекс для JSONB поиска
- `idx_events_metadata_gin` - GIN индекс для метаданных
- `idx_events_operation` - индекс по операциям
- `idx_events_entity_type` - индекс по типу сущности
- `idx_events_event_name` - индекс по названию события

---

## Примеры payload

### Car Update

```json
{
  "id": 38204,
  "mileage": [101191, 102035],
  "company_id": 9247,
  "status": "active",
  "location": "Tbilisi"
}
```

### Booking Create

```json
{
  "id": 501190,
  "car_id": 38204,
  "client_id": 12345,
  "company_id": 9247,
  "issue_planned_at": "2025-11-05T10:00:00Z",
  "return_planned_at": "2025-11-10T10:00:00Z"
}
```

### Client Update

```json
{
  "id": 12345,
  "name": ["Ivan", "Ivan Petrov"],
  "phone": ["+995551234567", "+995551234568"],
  "company_id": 9247
}
```

---

## Запросы для мониторинга

### Необработанные события (старше 10 минут)

```sql
SELECT 
  id,
  ts,
  entity_type,
  operation,
  rentprog_id,
  AGE(NOW(), ts) AS age
FROM events
WHERE processed = false
  AND ts < NOW() - INTERVAL '10 minutes'
ORDER BY ts ASC;
```

### Ошибки обработки за последний час

```sql
SELECT 
  id,
  ts,
  entity_type,
  operation,
  rentprog_id,
  company_id,
  reason
FROM events
WHERE ok = false
  AND ts > NOW() - INTERVAL '1 hour'
ORDER BY ts DESC;
```

### Дубликаты (по event_hash)

```sql
SELECT 
  event_hash,
  COUNT(*) AS duplicates
FROM events
WHERE event_hash IS NOT NULL
GROUP BY event_hash
HAVING COUNT(*) > 1;
```

---

## TypeScript типы

```typescript
// src/types/event.ts
export interface Event {
  id: number;
  ts: Date;
  event_hash?: string;
  
  // Классификация
  type?: string;
  event_name?: string;
  entity_type?: 'car' | 'client' | 'booking';
  operation?: 'create' | 'update' | 'delete';
  
  // Связь с RentProg
  rentprog_id?: string;
  company_id?: number;
  ext_id?: string;
  
  // Данные
  payload?: Record<string, any>;
  metadata?: Record<string, any>;
  
  // Обработка
  processed: boolean;
  ok: boolean;
  reason?: string;
}
```

---

## См. также

- [docs/BRANCHES_TABLE.md](./BRANCHES_TABLE.md) - Таблица филиалов
- [docs/WEBHOOK_EVENT_VALIDATION.md](./WEBHOOK_EVENT_VALIDATION.md) - Валидация событий
- [ORCHESTRATOR.md](../ORCHESTRATOR.md) - Оркестратор событий

