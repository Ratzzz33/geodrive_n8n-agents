# Чеклист: Обновление workflow для отслеживания источника изменений

**Дата:** 2025-01-20

---

## ✅ Уже обновлено

### 1. RentProg Upsert Processor
- **Файл:** `n8n-workflows/rentprog-upsert-processor.json`
- **Нода:** "Process Event via Jarvis" (ID: `process-event-node`)
- **Изменения:**
  - ✅ Добавлен `sendHeaders: true`
  - ✅ Добавлены headers: `X-Source`, `X-Workflow-Id`, `X-Workflow-Name`, `X-Execution-Id`
  - ✅ Добавлен `eventId` в body
- **Статус:** ✅ Готово к импорту

### 2. RentProg Events Auto Processor
- **Файл:** `n8n-workflows/rentprog-events-auto-processor.json`
- **Нода:** "Process Event via Jarvis" (ID: `process-event`)
- **Изменения:** Те же, что выше
- **Статус:** ✅ Готово к импорту

---

## ⚠️ Требуют обновления

### 3. Processor Workflows (4 филиала)

**Файлы:**
- `tbilisi-processor.json`
- `batumi-processor.json`
- `kutaisi-processor.json`
- `service-center-processor.json`

**Что сделать:**

1. **Найти ноду "Save to Events"** (Postgres)
2. **Добавить новую ноду HTTP Request** после неё
3. **Настроить ноду:**

**Параметры ноды:**

| Параметр | Значение |
|----------|----------|
| **Тип** | HTTP Request |
| **Название** | Process Event via Jarvis |
| **Method** | POST |
| **URL** | `={{ $env.ORCHESTRATOR_URL || 'http://46.224.17.15:3000' }}/process-event` |

**Headers:**
```
X-Source: n8n_workflow
X-Workflow-Id: ={{ $workflow.id }}
X-Workflow-Name: ={{ $workflow.name }}
X-Execution-Id: ={{ $execution.id }}
```

**Body:**
```
branch: ={{ $('Parse Webhook').item.json.metadata.branch || 'tbilisi' }}
type: ={{ $('Parse Webhook').item.json.event_name }}
rentprog_id: ={{ $('Parse Webhook').item.json.rentprog_id }}
eventId: ={{ $('Save to Events').item.json.id }}
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

**Миграция:** Создать файл `setup/migrations/022_update_snapshot_trigger_change_tracking.sql`

---

### 5. History Parser Workflows

**Файлы:**
- `rentprog-events-scraper.json`
- `history-matcher-processor.json`

**Что сделать:**
- Если вызывают Jarvis API → добавить headers (как в пункте 3)
- Если напрямую обновляют БД → добавить поля в UPDATE запросы

---

## 📋 Итоговая таблица

| Workflow | Нода для обновления | Тип | Статус | Действие |
|----------|---------------------|-----|--------|----------|
| **rentprog-upsert-processor.json** | Process Event via Jarvis | HTTP Request | ✅ Обновлено | Импортировать |
| **rentprog-events-auto-processor.json** | Process Event via Jarvis | HTTP Request | ✅ Обновлено | Импортировать |
| **tbilisi-processor.json** | - | - | ⚠️ Нет ноды | Добавить HTTP Request |
| **batumi-processor.json** | - | - | ⚠️ Нет ноды | Добавить HTTP Request |
| **kutaisi-processor.json** | - | - | ⚠️ Нет ноды | Добавить HTTP Request |
| **service-center-processor.json** | - | - | ⚠️ Нет ноды | Добавить HTTP Request |
| **rentprog-cars-snapshot.json** | Upsert Cars to PostgreSQL | Postgres | ⚠️ Требует триггер | Обновить триггер |
| **rentprog-events-scraper.json** | UPDATE cars | Postgres | ⚠️ Требует обновления | Добавить поля в SQL |

---

## 🚀 Приоритеты

### P0 (Критично - сделать сейчас)
1. ✅ Импортировать обновленные workflow (2 файла)
2. ⚠️ Обновить processor workflows (4 файла) - добавить ноды HTTP Request

### P1 (Важно - на этой неделе)
3. ⚠️ Обновить триггер `sync_cars_from_snapshot_trigger`
4. ⚠️ Обновить history parser workflows

---

## 📝 Пошаговая инструкция для processor workflows

### Шаг 1: Открыть workflow в n8n

1. Перейти на https://n8n.rentflow.rentals
2. Найти workflow (например, "Tbilisi Processor Rentprog")
3. Открыть для редактирования

### Шаг 2: Найти ноду "Save to Events"

1. Найти ноду типа Postgres с названием "Save to Events"
2. Запомнить её позицию

### Шаг 3: Добавить ноду HTTP Request

1. Нажать "+" для добавления ноды
2. Выбрать "HTTP Request"
3. Настроить как в примере выше
4. Подключить: "Save to Events" → новая нода → следующая нода

### Шаг 4: Сохранить и активировать

1. Сохранить workflow
2. Активировать если нужно
3. Протестировать на реальных данных

---

## 🔍 Проверка после обновления

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
- `docs/WORKFLOWS_TO_UPDATE_CHANGE_TRACKING.md` - Детальный список
- `docs/WORKFLOWS_UPDATE_INSTRUCTIONS.md` - Пошаговые инструкции
- `docs/WORKFLOWS_UPDATE_SUMMARY.md` - Сводка

