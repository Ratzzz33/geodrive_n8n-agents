# Валидация событий вебхуков RentProg

**Дата:** 2025-01-16  
**Статус:** ✅ Реализовано

---

## Обзор

Воркфлоу `RentProg Webhooks Monitor` теперь умеет распознавать и валидировать **9 типов событий** от RentProg с проверкой формата для каждого типа.

---

## Известные типы событий

### 1. События машин (Car)

| Тип события | Операция | Обязательные поля |
|-------------|----------|-------------------|
| `car_create` | create | `id`, `company_id`, (`plate_number` ИЛИ `model`) |
| `car_update` | update | `id`, `company_id`, хотя бы одно из: `mileage`, `clean_state`, `status`, `location`, `plate_number` |
| `car_destroy` | destroy | `id`, `company_id` |

### 2. События клиентов (Client)

| Тип события | Операция | Обязательные поля |
|-------------|----------|-------------------|
| `client_create` | create | `id`, `company_id`, (`name` ИЛИ `phone`) |
| `client_update` | update | `id`, `company_id`, хотя бы одно из: `name`, `phone`, `email`, `passport`, `license` |
| `client_destroy` | destroy | `id`, `company_id` |

### 3. События броней (Booking)

| Тип события | Операция | Обязательные поля |
|-------------|----------|-------------------|
| `booking_create` | create | `id`, `company_id`, `car_id`, `client_id` |
| `booking_update` | update | `id`, `company_id`, хотя бы одно из: `status`, `issue_planned_at`, `return_planned_at`, `car_id`, `client_id` |
| `booking_destroy` | destroy | `id`, `company_id` |

---

## Логика валидации

### Шаг 1: Парсинг payload
- Попытка парсинга как JSON
- Если не удалось → попытка парсинга как Ruby hash
- Извлечение `rentprog_id` из `payload.id`

### Шаг 2: Определение типа события
- Сравнение `rawEvent` с массивом `knownEventTypes`
- Поддержка вариаций: `car_update`, `carupdate`, `car.update`
- Если не найдено → `eventType = 'unknown'`

### Шаг 3: Определение сущности и операции
- Извлечение `entityType`: `car`, `client`, `booking`
- Извлечение `operation`: `create`, `update`, `destroy`

### Шаг 4: Валидация формата
Функция `validateEventFormat(eventType, parsedPayload, validationErrors)`:

#### Базовая валидация (для всех типов):
- ✅ `payload.id` должен быть определен (обязательное поле)

#### Специфическая валидация по типу события:

**`car_update`:**
- Хотя бы одно из полей: `mileage`, `clean_state`, `status`, `location`, `plate_number`

**`client_update`:**
- Хотя бы одно из полей: `name`, `phone`, `email`, `passport`, `license`

**`booking_update`:**
- Хотя бы одно из полей: `status`, `issue_planned_at`, `return_planned_at`, `car_id`, `client_id`

**`car_create`:**
- `plate_number` ИЛИ `model`

**`client_create`:**
- `name` ИЛИ `phone`

**`booking_create`:**
- `car_id` И `client_id`

**`*_destroy`:**
- Только базовая валидация (`id`, `company_id`)

### Шаг 5: Итоговая проверка

`isKnownFormat = true` ТОЛЬКО если:
1. ✅ Payload распарсен (`parsedPayload` не пустой)
2. ✅ `rentprog_id` извлечен (`!== 'unknown'`)
3. ✅ `eventType` определен (`!== 'unknown'`)
4. ✅ `entityType` определен (`!== 'unknown'`)
5. ✅ `operation` определена (`!== 'unknown'`)
6. ✅ Нет ошибок валидации (`validationErrors.length === 0`)
7. ✅ Формат валиден для данного типа события (`formatValid === true`)

---

## Примеры

### ✅ Известный формат: `car_update`

**Входящий вебхук:**
```json
{
  "event": "car_update",
  "payload": "{\"id\"=>65311, \"mileage\"=>[101191, 102035], \"company_id\"=>9247}"
}
```

**Результат парсинга:**
```javascript
{
  rentprogId: "65311",
  eventType: "car_update",
  entityType: "car",
  operation: "update",
  companyId: 9247,
  isKnownFormat: true,
  validationErrors: []
}
```

**Маршрут:** `Known Format` → `Auto Process` (Jarvis API)

---

### ✅ Известный формат: `client_create`

**Входящий вебхук:**
```json
{
  "event": "client_create",
  "payload": "{\"id\"=>12345, \"name\"=>\"Ivan Petrov\", \"phone\"=>\"+995551234567\", \"company_id\"=>9247}"
}
```

**Результат парсинга:**
```javascript
{
  rentprogId: "12345",
  eventType: "client_create",
  entityType: "client",
  operation: "create",
  companyId: 9247,
  isKnownFormat: true,
  validationErrors: []
}
```

**Маршрут:** `Known Format` → `Auto Process` → вернет `needsUpsert: true` → `Trigger Upsert Processor`

---

### ❌ Неизвестный формат: отсутствует обязательное поле

**Входящий вебхук:**
```json
{
  "event": "car_update",
  "payload": "{\"id\"=>65311, \"company_id\"=>9247}"
}
```

**Результат парсинга:**
```javascript
{
  rentprogId: "65311",
  eventType: "car_update",
  entityType: "car",
  operation: "update",
  companyId: 9247,
  isKnownFormat: false,
  validationErrors: ["car_update: нет полей для обновления (ожидается хотя бы одно из: mileage, clean_state, status, location, plate_number)"]
}
```

**Маршрут:** `Unknown Format` → `Debug: Unknown Format` (Telegram алерт)

---

### ❌ Неизвестный формат: неизвестный тип события

**Входящий вебхук:**
```json
{
  "event": "car_moved",
  "payload": "{\"id\"=>65311, \"company_id\"=>9247, \"location\"=>\"Tbilisi\"}"
}
```

**Результат парсинга:**
```javascript
{
  rentprogId: "65311",
  eventType: "unknown",
  entityType: "unknown",
  operation: "unknown",
  companyId: 9247,
  isKnownFormat: false,
  validationErrors: ["Неизвестный тип события: car_moved"]
}
```

**Маршрут:** `Unknown Format` → `Debug: Unknown Format` (Telegram алерт)

---

## Маршрутизация в воркфлоу

```
Webhook
  ↓
Respond (Fast ACK) ← 200 OK < 100ms
  ↓
Parse & Validate Format
  ↓
If Known Format?
  ├─ YES (isKnownFormat = true)
  │    ↓
  │  Auto Process → Jarvis /process-webhook
  │    ↓
  │  If Needs Upsert?
  │    ├─ YES → Trigger Upsert Processor
  │    └─ NO → Set Query Params → Save Event (processed=true)
  │
  └─ NO (isKnownFormat = false)
       ↓
     Debug: Unknown Format → Telegram Alert
       ↓
     Set Query Params → Save Event (processed=false)
       ↓
     Log Error to DB
```

---

## Тестирование

### 1. Отправить тестовый вебхук

```bash
node setup/send_test_webhook_simple.mjs
```

### 2. Проверить Telegram

- **Известный формат:** Уведомление НЕ приходит (обрабатывается автоматически)
- **Неизвестный формат:** Приходит алерт с деталями и ошибками валидации

### 3. Проверить БД

```sql
-- Все события за последний час
SELECT 
  id, ts, type, rentprog_id, company_id, 
  ok, processed, reason
FROM events
WHERE ts > NOW() - INTERVAL '1 hour'
ORDER BY ts DESC;

-- События с ошибками валидации
SELECT 
  id, ts, type, rentprog_id, reason
FROM events
WHERE ok = false
  AND ts > NOW() - INTERVAL '1 hour'
ORDER BY ts DESC;
```

### 4. Проверить логи ошибок

```sql
-- Детальные логи ошибок
SELECT 
  id, ts, phase, kind, error, 
  event_type, rentprog_id, company_id
FROM webhook_error_log
WHERE ts > NOW() - INTERVAL '1 hour'
  AND kind = 'warn'
ORDER BY ts DESC;
```

---

## Обучение системы

### Процесс обучения

1. **Приходит неизвестный вебхук** → алерт в Telegram
2. **Анализируем структуру** payload и определяем:
   - Это новый тип события?
   - Это известный тип, но с новыми полями?
   - Это валидная структура или ошибка от RentProg?
3. **Обновляем валидацию:**
   - Добавляем новый тип в `knownEventTypes` (если нужно)
   - Обновляем список ожидаемых полей в `validateEventFormat()`
4. **Тестируем** с реальным вебхуком
5. **Деплоим** обновленный workflow

### Добавление нового типа события

**Пример:** Добавить `car_moved`

1. Обновить `setup/parse_code_with_validation.js`:

```javascript
const knownEventTypes = [
  'client_destroy',
  'car_destroy',
  'booking_destroy',
  'car_update',
  'client_update',
  'booking_update',
  'client_create',
  'booking_create',
  'car_create',
  'car_moved'  // ← Новый тип
];
```

2. Добавить валидацию в `validateEventFormat()`:

```javascript
case 'car_moved':
  // car_moved должен содержать location
  if (!payload.location) {
    errors.push('car_moved: отсутствует обязательное поле location');
    return false;
  }
  break;
```

3. Обновить workflow:

```bash
node setup/update_validation_code.mjs
node setup/update_workflow_via_api.mjs
```

---

## Метрики и мониторинг

### KPI валидации

1. **Процент известных форматов:**
   ```sql
   SELECT 
     COUNT(CASE WHEN ok = true THEN 1 END)::float / COUNT(*) * 100 AS known_percent
   FROM events
   WHERE ts > NOW() - INTERVAL '24 hours';
   ```

2. **Топ ошибок валидации:**
   ```sql
   SELECT 
     reason, 
     COUNT(*) as cnt
   FROM events
   WHERE ok = false
     AND ts > NOW() - INTERVAL '24 hours'
   GROUP BY reason
   ORDER BY cnt DESC
   LIMIT 10;
   ```

3. **Распределение по типам событий:**
   ```sql
   SELECT 
     type, 
     COUNT(*) as cnt,
     SUM(CASE WHEN ok = true THEN 1 ELSE 0 END) as ok_cnt,
     SUM(CASE WHEN ok = false THEN 1 ELSE 0 END) as error_cnt
   FROM events
   WHERE ts > NOW() - INTERVAL '24 hours'
   GROUP BY type
   ORDER BY cnt DESC;
   ```

---

## FAQ

### Q: Почему вебхук с типом `car_update` не обрабатывается автоматически?

**A:** Проверьте ошибки валидации в Telegram алерте. Скорее всего:
- Отсутствует `company_id`
- Отсутствуют все поля для обновления (mileage, clean_state, и т.д.)

### Q: Как добавить поддержку нового поля в `car_update`?

**A:** Обновите массив `carUpdateFields` в `validateEventFormat()`:

```javascript
const carUpdateFields = [
  'mileage', 'clean_state', 'status', 'location', 'plate_number',
  'new_field'  // ← Новое поле
];
```

### Q: Зачем нужна валидация формата, если RentProg отправляет корректные данные?

**A:** Валидация помогает:
1. Обнаружить изменения в API RentProg (новые/удаленные поля)
2. Отловить баги в интеграции
3. Контролировать качество данных перед обработкой
4. Обучать систему на реальных данных

---

## Связанные документы

- [WEBHOOK_ARCHITECTURE_ANALYSIS.md](./WEBHOOK_ARCHITECTURE_ANALYSIS.md) - Архитектура обработки вебхуков
- [WEBHOOK_IMPROVEMENTS_2025-01-15.md](./WEBHOOK_IMPROVEMENTS_2025-01-15.md) - Улучшения системы вебхуков
- [ARCHITECTURE.md](../ARCHITECTURE.md) - Общая архитектура системы
- [STRUCTURE.md](../STRUCTURE.md) - Структура данных

---

**Последнее обновление:** 2025-01-16  
**Версия:** 1.0  
**Статус:** ✅ Production Ready

