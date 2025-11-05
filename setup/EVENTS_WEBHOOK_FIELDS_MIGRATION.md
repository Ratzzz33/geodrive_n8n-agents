# ✅ Завершено: Добавление полей для вебхуков в таблицу events

**Дата:** 2025-11-04  
**Статус:** ✅ Успешно завершено

---

## Задача

Добавить в таблицу `events` поля для полного сохранения данных из вебхуков RentProg:
- Тип события (car_update)
- RentProg ID (38204)
- Company ID (9247, 11163)
- Полное JSON тело
- Дополнительные метаданные

---

## Выполненные действия

### 1. Проверка существующей структуры

**Скрипт:** `setup/check_events_table.mjs`

**Обнаружено:**
- ✅ Уже есть: `type`, `rentprog_id`, `company_id`
- ❌ Нет: полей для JSON payload и метаданных

### 2. Добавление новых полей

**Скрипт:** `setup/add_webhook_fields_to_events.mjs`

**Добавлено 5 новых полей:**

```sql
-- 1. Полное JSON тело вебхука
ALTER TABLE events ADD COLUMN payload JSONB;

-- 2. Операция (create/update/destroy)
ALTER TABLE events ADD COLUMN operation TEXT;

-- 3. Тип сущности (car/client/booking)
ALTER TABLE events ADD COLUMN entity_type TEXT;

-- 4. Полное название события
ALTER TABLE events ADD COLUMN event_name TEXT;

-- 5. Дополнительные метаданные
ALTER TABLE events ADD COLUMN metadata JSONB;
```

**Создано 5 новых индексов:**

```sql
-- GIN индексы для быстрого JSONB поиска
CREATE INDEX idx_events_payload_gin ON events USING gin(payload);
CREATE INDEX idx_events_metadata_gin ON events USING gin(metadata);

-- B-tree индексы для фильтрации
CREATE INDEX idx_events_operation ON events(operation);
CREATE INDEX idx_events_entity_type ON events(entity_type);
CREATE INDEX idx_events_event_name ON events(event_name);
```

---

## Результат

### Полная структура таблицы events

```
events (15 полей)
├── Идентификация
│   ├── id (BIGSERIAL) - PK
│   ├── ts (TIMESTAMPTZ) - время события
│   └── event_hash (TEXT) - hash для дедупликации
│
├── Классификация события
│   ├── type (TEXT) - короткий тип
│   ├── event_name (TEXT) 🆕 - полное название
│   ├── entity_type (TEXT) 🆕 - car | client | booking
│   └── operation (TEXT) 🆕 - create | update | destroy
│
├── Связь с RentProg
│   ├── rentprog_id (TEXT) - ID сущности (38204)
│   ├── company_id (INTEGER) - ID филиала (9247, 9248, 9506, 11163)
│   └── ext_id (TEXT) - legacy
│
├── Данные события
│   ├── payload (JSONB) 🆕 - полное JSON тело
│   └── metadata (JSONB) 🆕 - метаданные
│
└── Статус обработки
    ├── processed (BOOLEAN) - обработано?
    ├── ok (BOOLEAN) - успешно?
    └── reason (TEXT) - причина ошибки
```

---

## Примеры использования

### 1. Сохранение события из вебхука

```sql
INSERT INTO events (
  -- Классификация
  type,
  event_name,
  entity_type,
  operation,
  
  -- RentProg связь
  rentprog_id,
  company_id,
  
  -- Данные
  payload,
  metadata,
  
  -- Дедупликация
  event_hash
) VALUES (
  'car_update',
  'car_update',
  'car',
  'update',
  '38204',
  9247,
  '{
    "id": 38204,
    "mileage": [101191, 102035],
    "company_id": 9247,
    "status": "active"
  }'::jsonb,
  '{
    "source": "webhook",
    "received_at": "2025-11-04T05:00:00Z",
    "user_agent": "RentProg/1.0"
  }'::jsonb,
  md5('9247_car_update_38204')
)
ON CONFLICT (company_id, type, rentprog_id) DO NOTHING
RETURNING id;
```

### 2. Получение событий по филиалу с деталями

```sql
SELECT 
  e.id,
  e.ts,
  e.event_name,
  e.entity_type,
  e.operation,
  e.rentprog_id,
  b.code AS branch,
  b.name AS branch_name,
  e.payload,
  e.processed
FROM events e
LEFT JOIN branches b ON b.company_id = e.company_id
WHERE e.company_id = 9247  -- Tbilisi
  AND e.ts > NOW() - INTERVAL '24 hours'
ORDER BY e.ts DESC;
```

### 3. Поиск в JSON payload

```sql
-- Найти все события где изменился пробег
SELECT 
  id,
  ts,
  rentprog_id,
  payload->'mileage' AS mileage_change
FROM events
WHERE payload ? 'mileage'
  AND jsonb_array_length(payload->'mileage') = 2;

-- Найти события с конкретным статусом
SELECT *
FROM events
WHERE payload @> '{"status": "active"}'::jsonb;

-- Найти события по диапазону значений
SELECT *
FROM events
WHERE (payload->>'mileage')::int > 100000;
```

### 4. Статистика по типам событий

```sql
SELECT 
  entity_type,
  operation,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE processed = true) AS processed,
  COUNT(*) FILTER (WHERE ok = false) AS errors,
  MIN(ts) AS first_event,
  MAX(ts) AS last_event
FROM events
WHERE ts > NOW() - INTERVAL '7 days'
GROUP BY entity_type, operation
ORDER BY total DESC;
```

---

## Обновление n8n workflow

### RentProg Webhooks Monitor

**Code node: Parse & Validate Format**

```javascript
// Извлечение данных из вебхука
const eventName = $json.body.event || $json.event;
const payloadStr = $json.body.payload || $json.payload;
const parsedPayload = typeof payloadStr === 'string' 
  ? JSON.parse(payloadStr) 
  : payloadStr;

// Определение entity_type и operation
const entityType = determineEntityType(eventName); // car, client, booking
const operation = determineOperation(eventName);   // create, update, delete

return [{
  json: {
    event_name: eventName,
    entity_type: entityType,
    operation: operation,
    rentprog_id: parsedPayload.id?.toString(),
    company_id: parsedPayload.company_id,
    payload: parsedPayload,  // 🆕 полный payload
    metadata: {              // 🆕 метаданные
      source: 'webhook',
      received_at: new Date().toISOString(),
      headers: $json.headers
    }
  }
}];
```

**PostgreSQL node: Save Event**

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
)
VALUES (
  $1, -- event_name
  $2, -- entity_type
  $3, -- operation
  $4, -- rentprog_id
  $5, -- company_id
  $6::jsonb, -- payload
  $7::jsonb, -- metadata
  md5(CONCAT($5::text, '_', $2, '_', $4)), -- event_hash
  false
)
ON CONFLICT (company_id, type, rentprog_id) 
DO UPDATE SET
  payload = EXCLUDED.payload,
  metadata = EXCLUDED.metadata,
  updated_at = NOW()
RETURNING id;
```

---

## Преимущества новой структуры

### 1. Полная сохранность данных
- ✅ Весь payload сохраняется в JSONB
- ✅ Можно восстановить любые данные
- ✅ Нет потери информации

### 2. Гибкий поиск
- ✅ GIN индексы для быстрого JSONB поиска
- ✅ Поиск по любому полю в payload
- ✅ Сложные условия (диапазоны, массивы)

### 3. Классификация событий
- ✅ entity_type: car | client | booking
- ✅ operation: create | update | delete
- ✅ Удобная фильтрация и статистика

### 4. Метаданные
- ✅ Источник события (webhook/api/manual)
- ✅ Timestamp получения
- ✅ User agent, IP, headers
- ✅ Дополнительный контекст

### 5. Отладка и мониторинг
- ✅ Полная история событий
- ✅ Анализ ошибок
- ✅ Replay событий при необходимости
- ✅ Аудит изменений

---

## SQL для проверки

### Проверка структуры

```sql
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'events'
ORDER BY ordinal_position;
```

### Проверка индексов

```sql
SELECT 
  indexname, 
  indexdef
FROM pg_indexes
WHERE tablename = 'events'
ORDER BY indexname;
```

### Тестовая вставка

```sql
INSERT INTO events (
  event_name, entity_type, operation,
  rentprog_id, company_id,
  payload, metadata
) VALUES (
  'car_update', 'car', 'update',
  '38204', 9247,
  '{"id": 38204, "mileage": [100, 200]}'::jsonb,
  '{"source": "test"}'::jsonb
)
RETURNING id, ts, event_name, payload;
```

---

## Документация

Создана полная документация: [docs/EVENTS_TABLE.md](../docs/EVENTS_TABLE.md)

**Содержит:**
- Полная структура таблицы
- Описание всех полей
- Все индексы и constraints
- Примеры SQL запросов
- Примеры payload для разных событий
- TypeScript типы
- Интеграция с n8n workflow

---

## Следующие шаги

1. ✅ **Обновить n8n workflow** для сохранения payload
2. ✅ **Добавить поле payload** в Upsert Processor
3. ✅ **Использовать metadata** для логирования
4. ⏳ **Создать dashboard** для мониторинга событий
5. ⏳ **Настроить алерты** на ошибки обработки

---

## Файлы

**Скрипты:**
- `setup/check_events_table.mjs` - проверка структуры
- `setup/add_webhook_fields_to_events.mjs` - миграция

**Документация:**
- `docs/EVENTS_TABLE.md` - полное описание
- `setup/EVENTS_WEBHOOK_FIELDS_MIGRATION.md` - этот отчёт

---

## Заключение

✅ **Задача выполнена успешно!**

Таблица `events` теперь содержит:
- ✅ **Полное JSON тело** (`payload`) - весь контекст вебхука
- ✅ **Классификация** (`entity_type`, `operation`) - удобная фильтрация
- ✅ **Метаданные** (`metadata`) - дополнительный контекст
- ✅ **GIN индексы** - быстрый поиск по JSON
- ✅ **Полная история** - аудит всех изменений

**Примеры данных:**
```sql
type: 'car_update'
event_name: 'car_update'
entity_type: 'car'
operation: 'update'
rentprog_id: '38204'
company_id: 9247
payload: {"id": 38204, "mileage": [101191, 102035], "company_id": 9247}
metadata: {"source": "webhook", "received_at": "2025-11-04T05:00:00Z"}
```

