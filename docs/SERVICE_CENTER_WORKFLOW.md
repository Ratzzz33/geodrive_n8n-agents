# Service Center Processor Workflow

**Дата создания:** 2025-11-04  
**Статус:** ✅ Готов к использованию

---

## Назначение

Обработка вебхуков от RentProg для филиала **Service Center** (company_id: 11163).

---

## Архитектура workflow

```
Webhook (прямой в n8n)
    ↓
Parse Webhook (парсинг Ruby hash → JSON)
    ↓
Save to Events (сохранение в таблицу events)
    ↓
Pass Data
    ↓
Switch by Operation
    ├─→ CREATE → Insert Entity → Respond
    ├─→ UPDATE → Check Exists
    │              ├─→ Exists → Update Entity → Respond
    │              └─→ Not Exists → Get Token → Fetch from RentProg → Insert → Respond
    └─→ DESTROY → Mark as Deleted → Respond
```

---

## Webhook URL

**Прямой адрес (без Nginx):**
```
https://n8n.rentflow.rentals/webhook/service-center-webhook
```

**Метод:** POST

**Настройка в RentProg:**
1. Откройте настройки филиала Service Center в RentProg
2. Перейдите в раздел Webhooks/API
3. Укажите URL: `https://n8n.rentflow.rentals/webhook/service-center-webhook`
4. Выберите события: car_*, client_*, booking_*

---

## Обработка операций

### 1. CREATE (создание)

**Входящий вебхук:**
```json
{
  "event": "booking_create",
  "payload": {
    "id": 506539,
    "created_from_api": true,
    "active": true,
    "state": "Новая",
    "start_date": "03-11-2025 19:00",
    "end_date": "07-11-2025 19:00",
    "days": 4,
    "price": 122.0,
    "rental_cost": 487.0,
    "total": 487.0
  }
}
```

**Процесс:**
1. Parse Webhook → парсинг payload
2. Save to Events → сохранение в `events` с company_id = 11163
3. Prepare Create → подготовка данных
4. Insert Entity → создание записи в `external_refs`:
   ```sql
   INSERT INTO external_refs (
     entity_type, entity_id, system, external_id, data
   ) VALUES (
     'booking', gen_random_uuid(), 'rentprog', '506539', payload::jsonb
   );
   ```
5. Respond Success → возврат `{ok: true, entity_id: "..."}`

---

### 2. UPDATE (обновление)

**Пример 1: Изменение company_id**
```json
{
  "event": "car_update",
  "payload": {
    "company_id": [9247, 11163],
    "id": 38204,
    "branch_name": "GeoDrive Auto Service"
  }
}
```

**Обработка массивов `[old, new]`:**
- `company_id: [9247, 11163]` → берём последнее значение `11163`
- `total: [763.0, 721.0]` → берём последнее значение `721.0`

**Процесс:**
1. Parse Webhook
2. Save to Events
3. Check Exists → проверка существования по rentprog_id
4. **Если EXISTS:**
   - Prepare Update → извлечение последних значений из `[old, new]`
   - Update Entity → обновление в `external_refs`:
     ```sql
     UPDATE external_refs
     SET data = data || updates::jsonb,
         updated_at = NOW()
     WHERE entity_id = '...'
     ```
5. **Если NOT EXISTS:**
   - Get RentProg Token → получение токена (company_token: `5y4j4gcs75o9n5s1e2vrxx4a`)
   - Switch by Entity → выбор endpoint
   - Fetch Car/Client/Booking → запрос к RentProg API:
     - `/search_cars?query=38204`
     - `/search_clients?query=...`
     - `/search_bookings?query=...`
   - Extract Result → извлечение найденной записи
   - Insert Fetched Entity → создание в БД
6. Respond Success

---

### 3. DESTROY (удаление)

**Входящий вебхук:**
```json
{
  "event": "client_destroy",
  "payload": {
    "id": 381164
  }
}
```

**Процесс:**
1. Parse Webhook
2. Save to Events
3. Mark as Deleted → пометка записи как удалённой:
   ```sql
   UPDATE external_refs
   SET data = jsonb_set(
         COALESCE(data, '{}'::jsonb),
         '{_deleted}',
         'true'::jsonb
       ),
       updated_at = NOW()
   WHERE system = 'rentprog'
     AND external_id = '381164'
   ```
4. Respond Success

**Важно:** Запись НЕ удаляется физически, только помечается флагом `_deleted: true`

---

## Nodes описание

### 1. Webhook (Service Center)
- **Тип:** n8n-nodes-base.webhook
- **Path:** `/webhook/service-center-webhook`
- **Метод:** POST
- **Прямой доступ** (не через Nginx)

### 2. Parse Webhook
- **Тип:** Code node
- **Функции:**
  - Парсинг Ruby hash → JSON
  - Определение entity_type (car/client/booking)
  - Определение operation (create/update/destroy)
  - Извлечение rentprog_id
  - Генерация event_hash

### 3. Save to Events
- **Тип:** PostgreSQL node
- **Операция:** INSERT с ON CONFLICT (дедупликация)
- **Поля:**
  - event_name, entity_type, operation
  - rentprog_id, company_id (11163)
  - payload (JSONB), metadata (JSONB)
  - event_hash, processed (false)

### 4. Switch by Operation
- **Тип:** Switch node
- **Маршруты:**
  - `create` → Prepare Create
  - `update` → Check Exists
  - `destroy` → Mark as Deleted

### 5. Prepare Create
- **Тип:** Code node
- **Функция:** Подготовка данных для INSERT

### 6. Insert Entity
- **Тип:** PostgreSQL node
- **Операция:** INSERT в `external_refs`
- **Таблица:** Определяется по entity_type

### 7. Check Exists
- **Тип:** PostgreSQL node
- **Запрос:** SELECT entity_id by rentprog_id

### 8. If Exists
- **Тип:** If node
- **True:** Update Entity
- **False:** Get RentProg Token → Fetch

### 9. Prepare Update
- **Тип:** Code node
- **Функция:** Извлечение последних значений из `[old, new]`

### 10. Update Entity
- **Тип:** PostgreSQL node
- **Операция:** UPDATE external_refs (jsonb merge)

### 11. Get RentProg Token
- **Тип:** Code node
- **Функция:** Получение request_token через company_token
- **Company Token:** `5y4j4gcs75o9n5s1e2vrxx4a`

### 12. Switch by Entity
- **Тип:** Switch node
- **Маршруты:**
  - `car` → Fetch Car
  - `client` → Fetch Client
  - `booking` → Fetch Booking

### 13-15. Fetch Car/Client/Booking
- **Тип:** HTTP Request nodes
- **URLs:**
  - `/search_cars?query={id}`
  - `/search_clients?query={id}`
  - `/search_bookings?query={id}`

### 16. Extract Result
- **Тип:** Code node
- **Функция:** Извлечение найденной записи из результатов

### 17. Insert Fetched Entity
- **Тип:** PostgreSQL node
- **Операция:** INSERT в external_refs

### 18. Mark as Deleted
- **Тип:** PostgreSQL node
- **Операция:** UPDATE с флагом `_deleted: true`

### 19. Respond Success
- **Тип:** Respond to Webhook node
- **Ответ:** `{ok: true, operation: "...", entity_id: "..."}`

---

## Примеры использования

### Тест CREATE

```bash
curl -X POST https://n8n.rentflow.rentals/webhook/service-center-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "booking_create",
    "payload": {
      "id": 506539,
      "state": "Новая",
      "total": 487.0
    }
  }'
```

### Тест UPDATE

```bash
curl -X POST https://n8n.rentflow.rentals/webhook/service-center-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "car_update",
    "payload": "{\"company_id\"=>[9247, 11163], \"id\"=>38204}"
  }'
```

### Тест DESTROY

```bash
curl -X POST https://n8n.rentflow.rentals/webhook/service-center-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "client_destroy",
    "payload": "{\"id\"=>381164}"
  }'
```

---

## Мониторинг

### Проверка событий в БД

```sql
-- Последние события Service Center
SELECT 
  id, ts, event_name, entity_type, operation,
  rentprog_id, processed
FROM events
WHERE company_id = 11163
ORDER BY ts DESC
LIMIT 10;

-- Необработанные события
SELECT COUNT(*) 
FROM events 
WHERE company_id = 11163 
  AND processed = false;

-- Ошибки обработки
SELECT *
FROM events
WHERE company_id = 11163
  AND ok = false
ORDER BY ts DESC;
```

### Executions в n8n

```
https://n8n.rentflow.rentals/workflow/{workflow_id}/executions
```

---

## Troubleshooting

### Проблема: Вебхук не доходит

**Проверка:**
1. Workflow активен?
2. URL правильный?
3. RentProg настроен на этот URL?

**Решение:**
```bash
# Проверить webhook в n8n
curl https://n8n.rentflow.rentals/webhook/service-center-webhook
# Должен вернуть 404 или 200
```

### Проблема: Entity не найдена

**Причина:** Записи нет в RentProg

**Проверка:**
```bash
# Проверить через RentProg API
curl "https://rentprog.net/api/v1/public/search_cars?query=38204" \
  -H "Authorization: Bearer {token}"
```

### Проблема: Не парсится payload

**Причина:** Неправильный формат Ruby hash

**Решение:** Parse Webhook node автоматически конвертирует:
- `=>` → `:`
- `nil` → `null`
- Добавляет кавычки к ключам

---

## Импорт workflow

```bash
node setup/import_service_center_workflow.mjs
```

**Файлы:**
- `n8n-workflows/service-center-processor.json` - workflow definition
- `setup/import_service_center_workflow.mjs` - скрипт импорта
- `docs/SERVICE_CENTER_WORKFLOW.md` - эта документация

---

## Связанные таблицы

### events
- Все входящие вебхуки с company_id = 11163

### external_refs
- Хранение всех сущностей из RentProg
- `system = 'rentprog'`
- `external_id` = rentprog_id
- `data` (JSONB) = полные данные

### branches
- `company_id = 11163` → `code = 'service-center'`

---

## См. также

- [docs/EVENTS_TABLE.md](./EVENTS_TABLE.md) - Таблица events
- [docs/BRANCHES_TABLE.md](./BRANCHES_TABLE.md) - Таблица branches
- [docs/RENTPROG_COMPLETE_GUIDE.md](./RENTPROG_COMPLETE_GUIDE.md) - RentProg API
- [OPERATION_DESTROY_COMPLETE.md](../OPERATION_DESTROY_COMPLETE.md) - Operation типы


