# Отслеживание источника изменений в БД

**Дата:** 2025-01-20  
**Статус:** ✅ Реализовано

---

## 🎯 Назначение

Система отслеживания источника изменений позволяет понять:
- **Кто/что** изменило данные в БД
- **Какой workflow/скрипт** инициировал изменение
- **Какая функция** выполнила изменение
- **ID execution** в n8n (для связи с логами)

---

## 📊 Структура БД

### Добавленные поля

В таблицы `cars`, `car_prices`, `clients`, `bookings` добавлены поля:

```sql
updated_by_source TEXT        -- Тип источника: 'rentprog_webhook', 'rentprog_history', 'snapshot_workflow', 'jarvis_api', 'manual', 'n8n_workflow', 'trigger', 'migration'
updated_by_workflow TEXT      -- ID или название workflow/скрипта
updated_by_function TEXT      -- Название функции/метода
updated_by_execution_id TEXT  -- ID execution в n8n
updated_by_user TEXT          -- Пользователь
updated_by_metadata JSONB     -- Дополнительные метаданные
```

### Индексы

```sql
CREATE INDEX idx_cars_updated_by_source ON cars(updated_by_source);
CREATE INDEX idx_cars_updated_by_workflow ON cars(updated_by_workflow);
CREATE INDEX idx_car_prices_updated_by_source ON car_prices(updated_by_source);
CREATE INDEX idx_car_prices_updated_by_workflow ON car_prices(updated_by_workflow);
```

---

## 🔧 Использование

### В TypeScript коде

```typescript
import { upsertCarFromRentProg } from '../db/upsert';

// При вызове функции передаем информацию об источнике
const result = await upsertCarFromRentProg(carData, branch, {
  source: 'rentprog_webhook',
  workflow: 'RentProg Upsert Processor',
  executionId: '12345',
  user: 'system',
  metadata: {
    event_type: 'car_update',
    received_at: new Date().toISOString(),
  },
});
```

### В API запросах

**Headers:**
```
X-Source: rentprog_webhook
X-Workflow-Id: fijJpRlLjgpxSJE7
X-Workflow-Name: RentProg Upsert Processor
X-Execution-Id: 12345
X-User-Id: user123
```

**Body:**
```json
{
  "type": "car_update",
  "rentprog_id": "39736",
  "source": "rentprog_webhook",
  "workflow": "RentProg Upsert Processor",
  "execution_id": "12345"
}
```

### В n8n workflow

**HTTP Request node:**
```json
{
  "method": "POST",
  "url": "http://46.224.17.15:3000/process-event",
  "headers": {
    "X-Source": "n8n_workflow",
    "X-Workflow-Id": "={{ $workflow.id }}",
    "X-Workflow-Name": "={{ $workflow.name }}",
    "X-Execution-Id": "={{ $execution.id }}"
  },
  "body": {
    "type": "car_update",
    "rentprog_id": "39736"
  }
}
```

---

## 📝 Типы источников

| Тип | Описание | Пример |
|-----|----------|--------|
| `rentprog_webhook` | Вебхук от RentProg | События car_update, booking_create |
| `rentprog_history` | Парсинг истории RentProg | History Parser workflow |
| `snapshot_workflow` | Синхронизация снимков | Snapshot workflow |
| `jarvis_api` | Прямой вызов API | Manual API call |
| `manual` | Ручное изменение | Admin panel |
| `n8n_workflow` | n8n workflow | Любой workflow |
| `trigger` | Триггер БД | Автоматические триггеры |
| `migration` | Миграция БД | SQL миграции |

---

## 🔍 Запросы для анализа

### Найти все изменения цены для автомобиля

```sql
SELECT 
  c.plate,
  c.model,
  c.price_hour,
  c.updated_by_source,
  c.updated_by_workflow,
  c.updated_by_function,
  c.updated_by_execution_id,
  c.updated_at
FROM cars c
JOIN external_refs er ON er.entity_id = c.id
WHERE er.external_id = '39736'
  AND er.system = 'rentprog'
ORDER BY c.updated_at DESC;
```

### Найти изменения от конкретного workflow

```sql
SELECT 
  c.plate,
  c.model,
  c.updated_by_source,
  c.updated_by_workflow,
  c.updated_at
FROM cars c
WHERE c.updated_by_workflow = 'RentProg Upsert Processor'
  AND c.updated_at >= NOW() - INTERVAL '24 hours'
ORDER BY c.updated_at DESC;
```

### Найти изменения цены утром 20-го числа

```sql
SELECT 
  c.plate,
  c.model,
  c.price_hour,
  c.updated_by_source,
  c.updated_by_workflow,
  c.updated_by_execution_id,
  c.updated_at
FROM cars c
JOIN external_refs er ON er.entity_id = c.id
WHERE er.external_id = '39736'
  AND er.system = 'rentprog'
  AND EXTRACT(DAY FROM c.updated_at) = 20
  AND EXTRACT(HOUR FROM c.updated_at) >= 6
  AND EXTRACT(HOUR FROM c.updated_at) < 12
ORDER BY c.updated_at ASC;
```

---

## 📋 Следующие шаги

1. ✅ Миграция применена
2. ✅ Schema обновлен
3. ✅ Функции upsert обновлены
4. ✅ API endpoint обновлен
5. ⏳ Обновить n8n workflows для передачи headers
6. ⏳ Обновить триггеры для сохранения источника
7. ⏳ Добавить поля в другие таблицы (clients, bookings)

---

## 🔗 Связанные файлы

- `setup/migrations/021_add_change_tracking_fields.sql` - Миграция
- `src/db/schema.ts` - Drizzle schema
- `src/db/upsert.ts` - Функции upsert
- `src/db/change-tracking.ts` - Helper функции
- `src/api/index.ts` - API endpoint
- `src/orchestrator/rentprog-handler.ts` - Обработчик событий

