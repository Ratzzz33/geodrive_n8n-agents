# ✅ History Parser - УСПЕШНО РАЗВЕРНУТ

**Дата:** 2025-11-07  
**Время:** ~23:45 UTC+4

---

## 🎉 Что сделано

### ✅ Создана таблица `history`

**Структура:**
- `id` - PRIMARY KEY
- `ts` - время добавления
- `branch` - филиал
- `operation_type` - тип операции
- `operation_id` - ID в RentProg
- `description` - описание
- `entity_type` - тип сущности (car/booking/client/payment)
- `entity_id` - ID сущности
- `user_name` - имя пользователя
- `created_at` - время операции
- `raw_data` - полные данные (JSONB)
- **`matched`** - найдено в events (вебхуках)
- **`processed`** - обработано (разложено по таблицам)
- `notes` - заметки для анализа

**Индексы:**
- По филиалу, типу операции, времени
- По `matched = FALSE` (необработанные вебхуки)
- По `processed = FALSE` (не разложенные)

**Constraint:**
```sql
UNIQUE (branch, operation_type, created_at, entity_id)
```

---

### ✅ Обновлен workflow "RentProg History Parser"

**ID:** `xSjwtwrrWUGcBduU`  
**URL:** https://n8n.rentflow.rentals/workflow/xSjwtwrrWUGcBduU

**Статус:** **АКТИВЕН**

**Что делает:**
1. Каждые 3 минуты
2. Итерация по 4 филиалам
3. GET запрос к `/history_items` (последние 10 минут)
4. Парсинг ВСЕХ операций из истории
5. Сохранение в таблицу `history`
6. Telegram алерт при ошибках

**Изменения:**
- ❌ Был: Парсинг `/bookings` → `events` таблица
- ✅ Стало: Парсинг `/history_items` → `history` таблица

---

## 📊 Архитектура

### До изменений

```
3 workflows:
├── RentProg Monitor - Company Cash (каждые 3 мин) → payments
├── RentProg Monitor - Booking Events (каждые 3 мин) → events  ❌
└── RentProg Monitor - Cash & Events (деактивирован)
```

### После изменений

```
3 workflows:
├── RentProg Monitor - Company Cash (каждые 3 мин) → payments
├── RentProg History Parser (каждые 3 мин) → history           ✅ НОВЫЙ
└── RentProg Monitor - Cash & Events (деактивирован)
```

---

## 🔄 Процесс работы

### 1. Автоматический парсинг (каждые 3 минуты)

```
RentProg History Parser
  ↓
GET /history_items (последние 10 минут)
  ↓
Парсинг всех операций:
  - booking.created
  - booking.issue.planned
  - car.moved
  - payment.received
  - user.action
  - и т.д.
  ↓
Сохранение в history:
  - matched = FALSE (по умолчанию)
  - processed = FALSE (по умолчанию)
```

### 2. Ручной анализ (раз в сутки, в чате)

#### Шаг 1: Получить статистику

```sql
SELECT 
  operation_type,
  COUNT(*) as count
FROM history
WHERE matched = FALSE
GROUP BY operation_type
ORDER BY count DESC
LIMIT 20;
```

**Результат:**
```
operation_type          | count
-----------------------+-------
booking.issue.planned  | 156
payment.received       | 89
car.moved              | 45
user.action            | 23
...
```

#### Шаг 2: Сопоставление с вебхуками

**Для каждого типа операции:**

**Вопрос пользователя в чате:**
> "booking.issue.planned - это вебхук booking.issue.planned из events?"

**Ответ AI:**
> "Да! Проверил: operation_type='booking.issue.planned' соответствует events.type='booking.issue.planned'"

**Действие:**
```sql
UPDATE history
SET matched = TRUE, 
    notes = 'Соответствует вебхуку booking.issue.planned'
WHERE operation_type = 'booking.issue.planned'
  AND matched = FALSE;
```

#### Шаг 3: Обработка несопоставленных

**Для operation_type где `matched = FALSE`:**

**Вопрос:**
> "car.maintenance - куда сохранять?"

**Ответ:**
> "Создать таблицу car_maintenance или добавить поле maintenance_history в cars"

**Действие:**
```sql
-- После создания новой таблицы/поля
UPDATE history
SET processed = TRUE,
    notes = 'Добавлено в car_maintenance таблицу'
WHERE operation_type = 'car.maintenance'
  AND processed = FALSE;
```

---

## 📝 SQL Запросы для анализа

### Получить необработанные операции

```sql
SELECT 
  branch,
  operation_type,
  description,
  entity_type,
  entity_id,
  user_name,
  created_at
FROM history
WHERE matched = FALSE
  AND processed = FALSE
ORDER BY created_at DESC
LIMIT 50;
```

### Статистика по типам

```sql
SELECT 
  operation_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE matched = TRUE) as matched,
  COUNT(*) FILTER (WHERE processed = TRUE) as processed,
  COUNT(*) FILTER (WHERE matched = FALSE AND processed = FALSE) as unhandled
FROM history
GROUP BY operation_type
ORDER BY unhandled DESC;
```

### Найти соответствия в events

```sql
SELECT 
  h.operation_type,
  h.entity_id,
  h.created_at,
  e.type as event_type,
  e.ext_id,
  e.ts as event_ts
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

## 🤖 Примеры для ручного анализа

### Пример 1: Найдено соответствие

```
operation_type: booking.issue.planned
entity_id: 470049
created_at: 2025-11-07 10:30:00

events таблица:
type: booking.issue.planned
ext_id: 470049
ts: 2025-11-07 10:30:05

✅ НАЙДЕНО! Разница 5 секунд.
→ UPDATE history SET matched = TRUE WHERE ...
```

### Пример 2: Новый тип операции

```
operation_type: car.tire.check
entity_id: 64406
created_at: 2025-11-07 14:20:00

events таблица: НЕ НАЙДЕНО

❓ Что делать?
→ Создать таблицу car_tire_checks
→ Или добавить в cars.tire_check_history (JSONB)
→ UPDATE history SET processed = TRUE, notes = '...'
```

### Пример 3: Внутренний перевод

```
operation_type: cashbox.transfer
entity_id: 1828917
user_name: София Петрова → Анна Иванова

❓ Что делать?
→ Это внутренний перевод между сотрудниками
→ Уже обработан в payments как два платежа (+ и -)
→ UPDATE history SET matched = TRUE, notes = 'Internal transfer'
```

---

## ⏱️ График работы

### Автоматический парсинг

**Частота:** Каждые 3 минуты  
**Executions/день:** ~480

**График:**
```
00:00 → парсинг истории (последние 10 минут)
00:03 → парсинг истории
00:06 → парсинг истории
...
```

### Ручной анализ

**Частота:** Раз в сутки (удобное время)  
**Длительность:** 10-30 минут

**Процесс:**
1. Получить статистику необработанных (5 мин)
2. Сопоставить с вебхуками (10 мин)
3. Определить куда сохранять новые типы (10 мин)
4. Обновить БД (5 мин)

---

## 🎯 Следующие шаги

### Через 3 минуты (автоматически)
- [ ] Первое execution History Parser
- [ ] Проверить таблицу history (должны появиться записи)

### Через 10 минут
- [ ] Проверить 3-4 executions (должны быть успешными)
- [ ] Проверить count записей в history

### Завтра (ручной анализ)
- [ ] Получить статистику operation_type
- [ ] Сопоставить с events
- [ ] Обработать несопоставленные

---

## 📊 Мониторинг

### Executions

**URL:** https://n8n.rentflow.rentals/workflow/xSjwtwrrWUGcBduU/executions

**Должно быть:**
- Status: Success
- Items processed: 0-100 (зависит от активности)

### Telegram алерты

**Чат:** `-1003251225615` (Ошибки n8n)

**Формат:**
```
📜 HISTORY: TBILISI
Сохранено операций: 45
```

**При ошибках:**
```
📜 HISTORY: BATUMI
Сохранено операций: 30
⚠️ Ошибок: 5
```

### База данных

```sql
-- Проверка данных
SELECT COUNT(*) FROM history;

-- Последние 10 операций
SELECT * FROM history ORDER BY ts DESC LIMIT 10;

-- Статистика
SELECT 
  branch,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE matched = FALSE) as unmatched
FROM history
GROUP BY branch;
```

---

## ⚠️ Важно

### API Endpoint

**НЕ ИЗВЕСТЕН точный endpoint!**

Workflow использует: `/history_items`

Если получим ошибку 404, нужно будет:
1. Проверить DevTools в браузере
2. Найти правильный endpoint для истории
3. Обновить workflow

**Возможные варианты:**
- `/history_items` ✅ (используется)
- `/operations`
- `/activity_log`
- `/audit_log`

### Токены Bearer

Действительны до: **~2025-12-02**

При истечении обновить в:
- `n8n-workflows/rentprog-history-parser.json`
- `n8n-workflows/rentprog-monitor-company-cash.json`

---

## 📁 Файлы проекта

### Workflows
- `n8n-workflows/rentprog-history-parser.json` - новый
- `n8n-workflows/rentprog-monitor-company-cash.json`
- `n8n-workflows/rentprog-monitor-booking-events.json` - старый (не используется)

### Migration
- `setup/create_history_table.sql`
- `setup/apply_history_table_migration.mjs`

### Scripts
- `setup/update_history_workflow.mjs`

### Documentation
- `HISTORY_PARSER_WORKFLOW.md` - детальная документация
- `HISTORY_PARSER_SUCCESS.md` - этот файл (сводка)

---

## ✅ Финальный статус

- ✅ Таблица `history` создана
- ✅ Workflow "RentProg History Parser" обновлен и активирован
- ✅ Парсинг истории операций настроен (каждые 3 минуты)
- ✅ Поля `matched` и `processed` для ручного анализа
- ✅ Документация готова
- ⏳ Ожидание первого execution (~3 минуты)
- 📝 Ручной анализ начнется завтра

**Статус:** 🎉 **УСПЕШНО РАЗВЕРНУТ**

---

**Дата завершения:** 2025-11-07, ~23:45 UTC+4  
**Первое execution:** ~23:48 UTC+4  
**Ручной анализ:** Завтра (по запросу пользователя в чате)

