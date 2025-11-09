# RentProg History Parser - Workflow для анализа операций

**Дата:** 2025-11-07  
**Статус:** ✅ Готово к деплою

---

## 🎯 Цель

Парсить **ВСЕ операции** из истории RentProg (`https://web.rentprog.ru/history`) для последующего ручного анализа и сопоставления с вебхуками.

---

## 📋 Что изменилось

### Было: "RentProg Monitor - Booking Events"
- Парсил `/bookings` (только брони)
- Сохранял в `events` таблицу
- Только события броней

### Стало: "RentProg History Parser"
- Парсит `/history_items` (ВСЕ операции)
- Сохраняет в `history` таблицу
- Все типы операций из истории филиала

---

## 🗄️ Таблица `history`

### Структура

```sql
CREATE TABLE history (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ,              -- время добавления в таблицу
  branch TEXT,                 -- филиал
  operation_type TEXT,         -- тип операции
  operation_id TEXT,           -- ID операции в RentProg
  description TEXT,            -- описание
  entity_type TEXT,            -- тип сущности (car/booking/client/payment)
  entity_id TEXT,              -- ID сущности
  user_name TEXT,              -- имя пользователя
  created_at TIMESTAMPTZ,      -- время операции
  raw_data JSONB,              -- полные данные
  matched BOOLEAN,             -- найдено в events (вебхуках)
  processed BOOLEAN,           -- обработано (разложено по таблицам)
  notes TEXT,                  -- заметки для ручного анализа
  
  UNIQUE (branch, operation_type, created_at, entity_id)
);
```

### Индексы

- `idx_history_branch` - по филиалу
- `idx_history_matched` - WHERE matched = FALSE (необработанные)
- `idx_history_processed` - WHERE processed = FALSE (не разложенные)
- `idx_history_created_at` - по времени
- `idx_history_operation_type` - по типу операции

---

## 🔄 Workflow

### Узлы (Nodes)

```
Every 3 Minutes (Cron)
  ↓
Prepare Branches (4 филиала)
  ↓
Build URLs (последние 10 минут)
  ↓
Get History Operations (HTTP → /history_items)
  ↓
Process History Data (парсинг всех операций)
  ↓
If Has Data? → YES → Save to History (Postgres)
              → NO  → No Data to Process
  ↓
Format Result
  ↓
If Error? → YES → Send Error Alert (Telegram)
          → NO  → Success
```

### API Endpoint

**URL:** `https://rentprog.net/api/v1/history_items`

**Query Parameters:**
- `created_at_from` - время начала (последние 10 минут)
- `created_at_to` - время окончания (сейчас)
- `per_page` - 100

**Headers:**
- `Authorization: Bearer {token}`
- `Accept: application/json`
- `Origin: https://web.rentprog.ru`
- `Referer: https://web.rentprog.ru/history`
- `User-Agent: Mozilla/5.0...`

---

## 📊 Процесс обработки данных

### 1. Парсинг (каждые 3 минуты)

Workflow автоматически парсит историю операций для всех филиалов.

### 2. Сохранение в БД

Все операции сохраняются в `history` с:
- `matched = FALSE` (по умолчанию)
- `processed = FALSE` (по умолчанию)

### 3. Ручной анализ (раз в сутки)

**Процесс:**

#### Шаг 1: Получить необработанные операции

```sql
-- Операции, которые НЕ найдены в вебхуках
SELECT 
  operation_type,
  COUNT(*) as count
FROM history
WHERE matched = FALSE
GROUP BY operation_type
ORDER BY count DESC
LIMIT 20;
```

#### Шаг 2: Анализ операций в чате

Для каждого типа операции:

**Вопрос:** "К какому вебхуку относится operation_type = 'booking.created'?"

**Ответ:** "booking.created → events (вебхук booking.issue.planned)"

**Действие:** Обновить `matched = TRUE` для найденных соответствий.

```sql
-- Пометить как найденные
UPDATE history
SET matched = TRUE, notes = 'Соответствует вебхуку booking.issue.planned'
WHERE operation_type = 'booking.created'
  AND matched = FALSE;
```

#### Шаг 3: Обработка несопоставленных операций

Для операций где `matched = FALSE`:

**Вопрос:** "Куда сохранить operation_type = 'car.maintenance'?"

**Ответ:** "Создать таблицу `car_maintenance` или добавить в `cars` как событие"

**Действие:** Разложить по таблицам и пометить `processed = TRUE`.

---

## 🤖 Примеры типов операций

### Операции с бронями
- `booking.created` - создание брони
- `booking.issue.planned` - запланирована выдача
- `booking.issue.completed` - выдача завершена
- `booking.return.planned` - запланирован возврат
- `booking.return.completed` - возврат завершен
- `booking.cancelled` - бронь отменена

### Операции с авто
- `car.created` - добавление авто
- `car.updated` - изменение данных
- `car.moved` - перемещение между филиалами
- `car.maintenance` - обслуживание
- `car.disabled` - недоступно для выдачи

### Операции с клиентами
- `client.created` - регистрация клиента
- `client.updated` - изменение данных

### Финансовые операции
- `payment.received` - получен платеж
- `payment.refund` - возврат средств
- `cashbox.transfer` - перевод между кассами

### Операции с пользователями
- `user.login` - вход пользователя
- `user.action` - действие пользователя

---

## 📝 SQL Запросы для анализа

### Получить последние необработанные операции

```sql
SELECT 
  branch,
  operation_type,
  description,
  entity_type,
  entity_id,
  user_name,
  created_at,
  raw_data
FROM history
WHERE matched = FALSE
  AND processed = FALSE
ORDER BY created_at DESC
LIMIT 50;
```

### Статистика по типам операций

```sql
SELECT 
  operation_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE matched = TRUE) as matched_count,
  COUNT(*) FILTER (WHERE processed = TRUE) as processed_count,
  COUNT(*) FILTER (WHERE matched = FALSE AND processed = FALSE) as unhandled
FROM history
GROUP BY operation_type
ORDER BY unhandled DESC, total DESC;
```

### Найти дубликаты в events

```sql
-- Операции, которые есть в history И в events
SELECT 
  h.operation_type,
  h.entity_id,
  h.created_at as history_time,
  e.type as event_type,
  e.ext_id as event_ext_id,
  e.ts as event_time
FROM history h
LEFT JOIN events e ON (
  h.branch = e.branch
  AND h.entity_id = e.ext_id
  AND ABS(EXTRACT(EPOCH FROM (h.created_at - e.ts))) < 60
)
WHERE h.matched = FALSE
  AND e.id IS NOT NULL
LIMIT 50;
```

---

## 🚀 Деплой

### 1. Применить миграцию

```bash
node setup/apply_history_table_migration.mjs
```

### 2. Обновить workflow

```bash
node setup/update_history_workflow.mjs
```

Это обновит существующий workflow `xSjwtwrrWUGcBduU` с:
- Новым именем: "RentProg History Parser"
- Новым endpoint: `/history_items`
- Сохранением в таблицу `history`

### 3. Проверка

Через 10 минут проверить:

```sql
-- Должны появиться записи
SELECT COUNT(*) FROM history;

-- Проверить последние операции
SELECT * FROM history ORDER BY ts DESC LIMIT 10;
```

---

## 🎯 Workflow для ручного анализа

### Ежедневная процедура (в чате)

**Время:** Ежедневно (удобное время)

**Шаги:**

1. **Получить статистику**
   ```sql
   SELECT operation_type, COUNT(*) 
   FROM history 
   WHERE matched = FALSE 
   GROUP BY operation_type 
   ORDER BY COUNT(*) DESC;
   ```

2. **Для каждого типа операции:**
   - Показать примеры (5-10 записей)
   - Определить соответствие с вебхуками
   - Если найдено → `matched = TRUE`
   - Если нет → определить куда сохранять

3. **Обновить БД**
   ```sql
   UPDATE history SET matched = TRUE, notes = '...' WHERE ...;
   UPDATE history SET processed = TRUE, notes = '...' WHERE ...;
   ```

4. **Создать новые таблицы/поля** (если нужно)

---

## ⚠️ Важно

### Дедупликация

Constraint `UNIQUE (branch, operation_type, created_at, entity_id)` предотвращает дубликаты.

При конфликте обновляются:
- `description`
- `raw_data`
- `ts` (время последнего обновления)

### Хранение данных

- `raw_data` содержит **полные данные** операции из RentProg
- Это позволяет анализировать и извлекать любые поля позже
- После обработки можно очистить `raw_data` (опционально)

### Matched vs Processed

- **`matched = TRUE`** - операция найдена в `events` (пришла через вебхук)
- **`processed = TRUE`** - операция обработана и разложена по таблицам
- Операция может быть `matched = FALSE` и `processed = TRUE` (новый тип события)

---

## 📁 Файлы проекта

### Workflow
- `n8n-workflows/rentprog-history-parser.json` - новый workflow

### Migration
- `setup/create_history_table.sql` - SQL миграция
- `setup/apply_history_table_migration.mjs` - применение миграции

### Scripts
- `setup/update_history_workflow.mjs` - обновление workflow

### Documentation
- `HISTORY_PARSER_WORKFLOW.md` - этот файл

---

## 🔍 Примеры операций из history

### Пример 1: Создание брони

```json
{
  "operation_type": "booking.created",
  "operation_id": "470049",
  "description": "Создана бронь #470049",
  "entity_type": "booking",
  "entity_id": "470049",
  "user_name": "Анна Иванова",
  "created_at": "2025-11-07T10:30:00+04:00",
  "raw_data": { ... }
}
```

### Пример 2: Платеж

```json
{
  "operation_type": "payment.received",
  "operation_id": "1828917",
  "description": "Получен платеж 224 GEL",
  "entity_type": "payment",
  "entity_id": "1828917",
  "user_name": "София Петрова",
  "created_at": "2025-11-07T12:15:00+04:00",
  "raw_data": { ... }
}
```

---

**Статус:** ✅ Готово к деплою  
**Следующий шаг:** `node setup/apply_history_table_migration.mjs`

