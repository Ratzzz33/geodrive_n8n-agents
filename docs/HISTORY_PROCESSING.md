# История операций RentProg - Автоматическая обработка

**Дата:** 2025-01-17  
**Статус:** ✅ Готово к деплою  
**Версия:** 1.0.0

---

## 📋 Оглавление

1. [Обзор](#обзор)
2. [Архитектура](#архитектура)
3. [Компоненты](#компоненты)
4. [Маппинг операций](#маппинг-операций)
5. [API Endpoints](#api-endpoints)
6. [n8n Workflow](#n8n-workflow)
7. [Стратегии обработки](#стратегии-обработки)
8. [Incremental Learning](#incremental-learning)
9. [Мониторинг](#мониторинг)
10. [Деплой](#деплой)

---

## Обзор

### Проблема

**RentProg отправляет только 9 типов вебхуков** (car/client/booking: create/update/destroy), но в реальности происходит гораздо больше операций:

- 💰 **Платежи** - не приходят в вебхуках
- 💵 **Кассовые операции** - инкассация, переводы
- 🔧 **Техобслуживание** - ТО, ремонты
- 📊 **Промежуточные статусы броней** - issue_completed, return_planned
- 👤 **Действия пользователей** - логи действий
- И многое другое...

### Решение

**Двухуровневая система обработки:**

1. **Вебхуки** (events) - быстрая обработка базовых CRUD операций
2. **История операций** (history) - парсинг ВСЕХfox операций + автоматическая обработка

```
┌─────────────────────────────────────┐
│  RentProg Webhooks (9 типов)       │  ← Быстро (real-time)
│  car/client/booking: CRUD           │
└──────────────┬──────────────────────┘
               │
               ▼
         ┌──────────┐
         │  events  │
         └──────────┘
         
┌─────────────────────────────────────┐
│  RentProg History API (ВСЕ)         │  ← Полнота (каждые 3 мин)
│  /history_items                     │
└──────────────┬──────────────────────┘
               │
               ▼
         ┌──────────┐
         │ history  │
         └─────┬────┘
               │
               ▼
    ┌──────────────────┐
    │ History Processor│  ← Автоматическая обработка
    └─────┬────────────┘
          │
          ▼
  ┌───────────────────────────┐
  │ payments, cars, bookings, │
  │ clients, employees        │
  └───────────────────────────┘
```

---

## Архитектура

### Поток обработки

```
1. RentProg History Items API
   └─> Workflow "RentProg History Parser" (каждые 3 мин)
       └─> Таблица history (matched=false, processed=false)

2. Workflow "History Matcher & Processor" (каждые 5 мин)
   ├─> Load Mappings (history_operation_mappings)
   ├─> Get Unprocessed (history WHERE processed=false)
   ├─> Match with Webhooks
   ├─> Process by Strategy
   │   ├─> extract_payment → payments
   │   ├─> update_employee_cash → employees
   │   ├─> add_maintenance_note → cars.history_log
   │   └─> update_booking_status → bookings
   └─> Mark as Processed

3. Monitoring & Learning
   ├─> Telegram Alerts (ошибки, новые операции)
   ├─> Daily Stats (ежедневная сводка)
   └─> Incremental Learning (автосоздание маппингов)
```

---

## Компоненты

### 1. База данных

#### Таблица `history_operation_mappings`

Маппинг типов операций на стратегии обработки.

```sql
CREATE TABLE history_operation_mappings (
  id BIGSERIAL PRIMARY KEY,
  operation_type TEXT UNIQUE,       -- Тип операции из history
  matched_event_type TEXT,          -- Вебхук (если есть)
  is_webhook_event BOOLEAN,         -- TRUE = skip processing
  target_table TEXT,                -- payments/cars/bookings/skip
  processing_strategy TEXT,         -- Стратегия обработки
  field_mappings JSONB,             -- JSONPath правила
  priority INTEGER,                 -- 100=skip, 90=critical, 70=normal
  enabled BOOLEAN,
  notes TEXT
);
```

**Примеры:**

```sql
-- Вебхук (skip)
operation_type: 'car_update'
is_webhook_event: true
processing_strategy: 'skip'

-- Платёж (обработка)
operation_type: 'payment.received'
target_table: 'payments'
processing_strategy: 'extract_payment'
field_mappings: {
  "amount": "$.amount",
  "currency": "$.currency",
  "rp_payment_id": "$.id"
}
```

#### Добавления в основные таблицы

Для ведения журнала изменений добавлено поле `history_log JSONB`:

- **cars.history_log** - ТО, ремонты, изменения статуса
- **bookings.history_log** - события броней, платежи
- **clients.history_log** - изменения контактов
- **employees.history_log** - кассовые операции

**Пример записи:**

```json
{
  "ts": "2025-01-17T12:00:00Z",
  "source": "history",
  "operation_type": "car.maintenance",
  "description": "Замена масла",
  "cost": 150,
  "mileage": 45000,
  "history_id": 12345
}
```

#### Views для мониторинга

**`history_processing_stats`** - Статистика по типам операций:

```sql
SELECT * FROM history_processing_stats
WHERE pending_count > 0
ORDER BY pending_count DESC;
```

**`unknown_operations`** - Новые типы операций (incremental learning):

```sql
SELECT * FROM unknown_operations
ORDER BY frequency DESC;
```

**`history_processing_queue`** - Приоритетная очередь обработки:

```sql
SELECT * FROM history_processing_queue
LIMIT 100;
```

---

### 2. TypeScript обработчики

**Файл:** `src/services/historyProcessor.ts`

#### Стратегии обработки

| Стратегия | Назначение | Целевая таблица |
|-----------|-----------|----------------|
| `extract_payment` | Извлечение платежей | `payments` |
| `update_employee_cash` | Обновление кассы | `employees` |
| `add_maintenance_note` | Добавить запись о ТО | `cars.history_log` |
| `update_car_status` | Обновить статус авто | `cars` |
| `update_booking_status` | Обновить статус брони | `bookings` |
| `skip` | Пропустить обработку | - |

#### Пример использования

```typescript
import { processHistoryItem, markHistoryProcessed } from './services/historyProcessor';

const item: HistoryItem = {
  id: 123,
  branch: 'tbilisi',
  operation_type: 'payment.received',
  raw_data: '{"amount": 500, "currency": "GEL"}'
  // ...
};

const mapping = {
  processing_strategy: 'extract_payment',
  field_mappings: { "amount": "$.amount" }
};

const result = await processHistoryItem(item, mapping);
await markHistoryProcessed(item.id, result);
```

---

### 3. API Endpoints

**Base URL:** `http://46.224.17.15:3000/process-history`

#### POST `/process-history`

Пакетная обработка операций.

**Request:**

```json
{
  "limit": 100,
  "operation_types": ["payment.received", "car.maintenance"],
  "branch": "tbilisi"
}
```

**Response:**

```json
{
  "ok": true,
  "processed": 45,
  "skipped": 10,
  "failed": 2,
  "results": [
    {
      "history_id": 123,
      "operation_type": "payment.received",
      "result": {
        "ok": true,
        "action": "payment_saved",
        "entityId": "uuid-123"
      }
    }
  ],
  "errors": ["Item 456: Car not found"]
}
```

#### GET `/process-history/stats`

Статистика обработки.

**Response:**

```json
{
  "ok": true,
  "summary": {
    "total_processed": 1523,
    "total_pending": 87,
    "total_matched": 450,
    "unique_operation_types": 25
  },
  "by_operation_type": [
    {
      "operation_type": "payment.received",
      "total_operations": 234,
      "processed_count": 230,
      "pending_count": 4
    }
  ]
}
```

#### GET `/process-history/unknown`

Неизвестные типы операций.

**Response:**

```json
{
  "ok": true,
  "unknown_operations": [
    {
      "operation_type": "car.relocated",
      "frequency": 15,
      "branches_count": 3,
      "sample_descriptions": ["Перемещение в Тбилиси"]
    }
  ]
}
```

#### POST `/process-history/learn`

Создать маппинг для нового типа операции (incremental learning).

**Request:**

```json
{
  "operation_type": "car.relocated",
  "target_table": "cars",
  "processing_strategy": "update_car_location",
  "field_mappings": {
    "car_rp_id": "$.entity_id",
    "to_branch": "$.location"
  },
  "priority": 70,
  "notes": "Перемещение автомобиля"
}
```

---

### 4. n8n Workflow

**Файл:** `n8n-workflows/history-matcher-processor.json`  
**Имя:** "History Matcher & Processor"

#### Триггеры

1. **Every 5 Minutes** - автоматическая обработка
2. **Daily at 9 AM** - ежедневная статистика

#### Основной поток (каждые 5 мин)

```
Every 5 Minutes
  ↓
Process History Batch (POST /process-history)
  ↓
Has Processed Items? → YES
  ├─> Format Log
  │   └─> Has Errors? → YES
  │       └─> Send Error Alert (Telegram)
  │
  └─> Check Unknown Operations
      └─> Has Unknown? → YES
          └─> Send Unknown Alert (Telegram)
```

#### Ежедневная статистика (9:00)

```
Daily at 9 AM
  ↓
Get Stats (GET /process-history/stats)
  ↓
Format Daily Stats
  ↓
Send Daily Stats (Telegram)
```

#### Telegram Alerts

**Канал:** `$env.TELEGRAM_ALERT_CHAT_ID`  
**Бот:** `@n8n_alert_geodrive_bot`

**Типы уведомлений:**

1. **Ошибки обработки** - при `failed > 0`
2. **Новые типы операций** - при обнаружении unknown
3. **Ежедневная статистика** - каждый день в 9:00

---

## Маппинг операций

### Приоритеты

| Приоритет | Назначение | Примеры |
|-----------|-----------|---------|
| 100 | Skip (вебхуки) | car_create, booking_update |
| 90 | Критичные | payment.received, cash.collected |
| 70 | Обычные | car.maintenance, booking.issued |
| 50 | Низкие | user.login, user.action |

### Базовый маппинг (примеры)

#### 1. Платежи

```sql
operation_type: 'payment.received'
target_table: 'payments'
processing_strategy: 'extract_payment'
priority: 90
field_mappings: {
  "payment_type": "$.payment_type",
  "amount": "$.amount",
  "currency": "$.currency",
  "rp_payment_id": "$.id",
  "rp_client_id": "$.client_id"
}
```

#### 2. Кассовые операции

```sql
operation_type: 'cash.collected'
target_table: 'employees'
processing_strategy: 'update_employee_cash'
priority: 90
field_mappings: {
  "employee_rp_id": "$.user_id",
  "amount": "$.amount",
  "currency": "$.currency",
  "operation": "collect"
}
```

#### 3. Техобслуживание

```sql
operation_type: 'car.maintenance'
target_table: 'cars'
processing_strategy: 'add_maintenance_note'
priority: 70
field_mappings: {
  "car_rp_id": "$.entity_id",
  "description": "$.description",
  "cost": "$.cost",
  "mileage": "$.mileage"
}
```

#### 4. Статусы броней

```sql
operation_type: 'booking.issue.completed'
target_table: 'bookings'
processing_strategy: 'update_booking_status'
priority: 70
field_mappings: {
  "booking_rp_id": "$.entity_id",
  "status": "issued",
  "issue_actual_at": "$.created_at",
  "mileage_start": "$.mileage"
}
```

---

## Стратегии обработки

### 1. `extract_payment`

**Назначение:** Извлечение платежей из истории.

**Алгоритм:**
1. Парсинг `raw_data`
2. Применение `field_mappings`
3. Поиск связанных сущностей через `external_refs`
4. Upsert в `payments` (ON CONFLICT rp_payment_id)

**Результат:** Платёж сохранён в БД.

---

### 2. `update_employee_cash`

**Назначение:** Обновление остатка кассы сотрудника.

**Алгоритм:**
1. Найти сотрудника по `rp_user_id` через `external_refs`
2. Определить валюту (GEL/USD/EUR)
3. Обновить поле `cash_gel/cash_usd/cash_eur`:
   - `collect` - вычитание (инкассация)
   - `adjust` - установка значения (корректировка)
4. Добавить запись в `history_log`

**Результат:** Касса сотрудника обновлена.

---

### 3. `add_maintenance_note`

**Назначение:** Добавление записи о техобслуживании в журнал автомобиля.

**Алгоритм:**
1. Найти автомобиль по `rp_car_id`
2. Подготовить запись с полями: `ts`, `description`, `cost`, `mileage`
3. Добавить в `cars.history_log` (JSONB append)

**Результат:** Запись о ТО в истории автомобиля.

---

### 4. `update_car_status`

**Назначение:** Обновление статуса автомобиля.

**Алгоритм:**
1. Найти автомобиль
2. Обновить `data.status`
3. Добавить запись в `history_log`

**Возможные статусы:** available, disabled, maintenance, rented

**Результат:** Статус обновлён + запись в логе.

---

### 5. `update_booking_status`

**Назначение:** Обновление статуса брони и связанных полей.

**Алгоритм:**
1. Найти бронь по `rp_booking_id`
2. Обновить статус + дополнительные поля:
   - `issue_planned_at`, `issue_actual_at`
   - `return_planned_at`, `return_actual_at`
   - `mileage_start`, `mileage_end`
   - `fuel_start`, `fuel_end`
3. Добавить запись в `history_log`

**Результат:** Бронь обновлена + история изменений.

---

## Incremental Learning

### Что это?

**Автоматическое обучение системы** на основе анализа неизвестных операций.

### Процесс

```
1. Workflow обнаруживает новый тип операции
   └─> Telegram Alert с примерами

2. Администратор анализирует:
   - Частоту операции
   - Доступные поля в raw_data
   - Целевую таблицу

3. Создание маппинга:
   POST /process-history/learn
   {
     "operation_type": "car.relocated",
     "target_table": "cars",
     "processing_strategy": "update_car_location",
     "field_mappings": {...}
   }

4. Автоматическая обработка начинается при следующем запуске
```

### SQL для анализа

```sql
-- Топ неизвестных операций
SELECT * FROM unknown_operations
ORDER BY frequency DESC
LIMIT 20;

-- Примеры raw_data для анализа
SELECT 
  operation_type,
  raw_data::jsonb,
  description
FROM history
WHERE operation_type = 'car.relocated'
LIMIT 5;

-- Доступные поля
SELECT DISTINCT jsonb_object_keys(raw_data::jsonb) as field
FROM history
WHERE operation_type = 'car.relocated';
```

---

## Мониторинг

### Dashboards

#### 1. Статистика обработки

```sql
SELECT * FROM history_processing_stats
ORDER BY pending_count DESC;
```

**Показатели:**
- Всего операций
- Обработано
- Ожидают обработки
- Сопоставлено с вебхуками

#### 2. Приоритетная очередь

```sql
SELECT * FROM history_processing_queue
LIMIT 100;
```

**Показатели:**
- ID операции
- Тип
- Приоритет
- Время ожидания (минуты)

#### 3. Неизвестные операции

```sql
SELECT * FROM unknown_operations;
```

**Показатели:**
- Тип операции
- Частота
- Количество филиалов
- Примеры описаний

### Telegram Alerts

**Настройка:**
- Переменная: `$env.TELEGRAM_ALERT_CHAT_ID`
- Бот: `@n8n_alert_geodrive_bot`

**Типы уведомлений:**

1. **Ошибки обработки** (при ошибках)
   ```
   ⚠️ History Processing Errors
   
   Processed: 45
   Failed: 5
   
   Errors:
   • payment.received: amount field missing
   • car.maintenance: car not found
   ```

2. **Новые операции** (при обнаружении)
   ```
   🔍 Обнаружены новые типы операций
   
   1. car.relocated
      • Частота: 15
      • Филиалы: 3
      • Примеры: Перемещение в Тбилиси
   ```

3. **Ежедневная статистика** (каждый день в 9:00)
   ```
   📊 History Processing - Daily Report
   
   Всего: 2,350 операций
   Обработано: 2,263 (96.3%)
   Ожидают: 87
   
   Топ необработанных:
   1. payment.received: 34 ожидают
   2. car.maintenance: 12 ожидают
   ```

---

## Деплой

### Шаг 1: Применить миграции

```bash
# 1. Подключиться к БД Neon
psql "postgresql://neondb_owner:npg_...@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

# 2. Выполнить миграции
\i setup/migrations/010_create_history_mappings.sql
\i setup/migrations/011_seed_history_mappings.sql

# 3. Проверить
SELECT COUNT(*) FROM history_operation_mappings;
SELECT * FROM history_processing_stats LIMIT 10;
SELECT * FROM unknown_operations;
```

**Или через Node.js:**

```bash
node setup/apply_history_migrations.mjs
```

---

### Шаг 2: Деплой TypeScript кода

```bash
# 1. Сборка
npm run build

# 2. Деплой на сервер
python deploy_fixes_now.py

# 3. Проверка API
curl http://46.224.17.15:3000/process-history/stats
```

---

### Шаг 3: Импорт n8n workflow

```bash
# Через n8n UI:
# 1. Открыть https://n8n.rentflow.rentals
# 2. Import from file: n8n-workflows/history-matcher-processor.json
# 3. Настроить credentials для Telegram Bot
# 4. Активировать workflow
```

**Или через API:**

```powershell
# PowerShell
$N8N_API_KEY = "your_key_here"
$workflow = Get-Content n8n-workflows/history-matcher-processor.json | ConvertFrom-Json

# Создать workflow
Invoke-RestMethod `
  -Uri "https://n8n.rentflow.rentals/api/v1/workflows" `
  -Method POST `
  -Headers @{"X-N8N-API-KEY"=$N8N_API_KEY} `
  -Body ($workflow | ConvertTo-Json -Depth 100)
```

---

### Шаг 4: Проверка работы

#### Проверка API

```bash
# Health check
curl http://46.224.17.15:3000/health

# Статистика
curl http://46.224.17.15:3000/process-history/stats

# Неизвестные операции
curl http://46.224.17.15:3000/process-history/unknown
```

#### Проверка обработки

```bash
# Запустить обработку вручную
curl -X POST http://46.224.17.15:3000/process-history \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

#### Проверка БД

```sql
-- Проверить обработанные операции
SELECT 
  operation_type,
  COUNT(*) FILTER (WHERE processed = TRUE) as processed_count,
  COUNT(*) FILTER (WHERE processed = FALSE) as pending_count
FROM history
GROUP BY operation_type
ORDER BY pending_count DESC;

-- Проверить history_log
SELECT plate, history_log 
FROM cars 
WHERE jsonb_array_length(history_log) > 0 
LIMIT 5;
```

---

## Troubleshooting

### Проблема: Обработка не запускается

**Проверка:**
```sql
-- 1. Есть ли необработанные операции?
SELECT COUNT(*) FROM history WHERE processed = FALSE;

-- 2. Есть ли маппинги?
SELECT COUNT(*) FROM history_operation_mappings WHERE enabled = TRUE;

-- 3. Активен ли workflow?
-- Проверить в n8n UI
```

**Решение:**
- Проверить, что workflow активен
- Проверить, что есть маппинги для типов операций
- Проверить логи: `docker logs jarvis-api`

---

### Проблема: Ошибки в обработке

**Проверка:**
```sql
-- Посмотреть ошибки
SELECT 
  operation_type,
  notes
FROM history
WHERE processed = FALSE 
  AND notes LIKE '%❌%'
LIMIT 20;
```

**Решение:**
- Проверить field_mappings в маппинге
- Проверить наличие связанных сущностей в external_refs
- Обновить маппинг через `/process-history/learn`

---

### Проблема: Неизвестные операции не обрабатываются

**Решение:**

1. Получить список неизвестных:
   ```bash
   curl http://46.224.17.15:3000/process-history/unknown
   ```

2. Проанализировать raw_data:
   ```sql
   SELECT raw_data FROM history 
   WHERE operation_type = 'unknown_type' 
   LIMIT 1;
   ```

3. Создать маппинг:
   ```bash
   curl -X POST http://46.224.17.15:3000/process-history/learn \
     -H "Content-Type: application/json" \
     -d '{
       "operation_type": "unknown_type",
       "target_table": "cars",
       "processing_strategy": "add_maintenance_note",
       "field_mappings": {"car_rp_id": "$.entity_id"}
     }'
   ```

---

## Best Practices

### 1. Регулярный анализ unknown_operations

**Частота:** 1 раз в неделю

```sql
SELECT * FROM unknown_operations 
WHERE frequency > 10
ORDER BY frequency DESC;
```

**Действие:** Создать маппинги для часто встречающихся операций.

---

### 2. Мониторинг ошибок

**Частота:** Ежедневно (автоматически через Telegram)

**Действие:** 
- Анализировать причины ошибок
- Исправлять маппинги
- Дополнять external_refs

---

### 3. Аудит history_log

**Частота:** 1 раз в месяц

```sql
-- Размер history_log по таблицам
SELECT 
  'cars' as table_name,
  AVG(jsonb_array_length(history_log)) as avg_entries,
  MAX(jsonb_array_length(history_log)) as max_entries
FROM cars
WHERE jsonb_array_length(history_log) > 0
UNION ALL
SELECT 
  'bookings',
  AVG(jsonb_array_length(history_log)),
  MAX(jsonb_array_length(history_log))
FROM bookings
WHERE jsonb_array_length(history_log) > 0;
```

**Действие:** Архивировать старые записи если history_log растёт слишком быстро.

---

### 4. Оптимизация приоритетов

```sql
-- Время ожидания обработки
SELECT 
  operation_type,
  priority,
  AVG(EXTRACT(EPOCH FROM (processed_at - created_at)) / 60) as avg_wait_minutes
FROM history h
JOIN history_operation_mappings m USING (operation_type)
WHERE h.processed = TRUE
  AND h.processed_at IS NOT NULL
GROUP BY operation_type, priority
ORDER BY avg_wait_minutes DESC;
```

**Действие:** Повысить приоритет для операций с долгим ожиданием.

---

## Roadmap

### v1.1 (Февраль 2025)

- [ ] ML-классификатор для автосоздания маппингов
- [ ] Поддержка условных правил (if-then в field_mappings)
- [ ] Batch processing оптимизация (обработка 1000+ операций)

### v1.2 (Март 2025)

- [ ] История изменений с rollback
- [ ] Экспорт history_log в отдельную таблицу (архив)
- [ ] Grafana dashboard для мониторинга

### v1.3 (Апрель 2025)

- [ ] Распознавание текста в описаниях (NLP)
- [ ] Автоматическая категоризация maintenance операций
- [ ] Интеграция с YouGile (создание задач из history)

---

## Заключение

**История операций RentProg** теперь обрабатывается автоматически с:

✅ **Полнотой данных** - все операции, не только вебхуки  
✅ **Автоматизацией** - без ручной работы  
✅ **Расширяемостью** - легко добавлять новые типы  
✅ **Мониторингом** - Telegram алерты + статистика  
✅ **Аудитом** - history_log для всех изменений  

**Статус:** ✅ Готово к продакшену

---

**Контакты:**  
- Документация: `docs/HISTORY_PROCESSING.md`
- API: `http://46.224.17.15:3000/process-history`
- n8n Workflow: `https://n8n.rentflow.rentals`
- Telegram Alerts: `@n8n_alert_geodrive_bot`

