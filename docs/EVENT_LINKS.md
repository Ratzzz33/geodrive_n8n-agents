# Event Links - Связи между events, payments и history

**Дата создания:** 2025-11-09  
**Статус:** ✅ Реализовано

---

## 🎯 Назначение

Таблица `event_links` связывает одни и те же процессы из разных источников данных:

- **`events`** (вебхуки) - события в реальном времени от RentProg
- **`payments`** (платежи) - разложенные финансовые данные
- **`history`** (история) - полный лог операций из RentProg History API

Все три таблицы описывают одни и те же процессы (кассы, машины, брони, клиенты), но с разных точек зрения.

---

## 📊 Структура таблицы

```sql
CREATE TABLE event_links (
  id UUID PRIMARY KEY,
  
  -- Связь с основными сущностями
  entity_type TEXT NOT NULL,  -- 'car' | 'booking' | 'client' | 'payment' | 'employee'
  entity_id UUID,              -- UUID из базовых таблиц
  
  -- Связи с источниками данных
  event_id BIGINT REFERENCES events(id),
  payment_id UUID REFERENCES payments(id),
  history_id BIGINT REFERENCES history(id),
  
  -- RentProg идентификаторы
  rp_entity_id TEXT,           -- ID сущности в RentProg
  rp_company_id INTEGER,        -- ID филиала в RentProg
  
  -- Метаданные связи
  link_type TEXT,              -- 'webhook_to_payment' | 'history_to_payment' | 'webhook_to_history' | 'all'
  confidence TEXT,             -- 'high' | 'medium' | 'low'
  matched_at TIMESTAMPTZ,      -- Когда была установлена связь
  matched_by TEXT,             -- 'auto' | 'manual' | 'workflow'
  
  -- Дополнительные данные
  metadata JSONB,
  
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

---

## 🔗 Типы связей

### `link_type`

- **`webhook_to_payment`** - связь между вебхуком (event) и платежом
- **`history_to_payment`** - связь между историей и платежом
- **`webhook_to_history`** - связь между вебхуком и историей
- **`all`** - связь всех трех источников

### `confidence`

- **`high`** - точное совпадение по ID и времени (< 1 минуты)
- **`medium`** - частичное совпадение (один источник + время близко)
- **`low`** - предположение (только по времени или другим признакам)

---

## 🤖 Автоматическое связывание

### При сохранении платежа

Автоматически вызывается после сохранения платежа в `savePaymentFromRentProg()`:

```typescript
// Автоматически связать с events и history
await linkPayment(
  paymentId,
  branch,
  rpPaymentId,
  paymentDate,
  { timeWindowSeconds: 300, autoCreate: true }
);
```

**Алгоритм:**

1. Поиск события в `events` по:
   - `entity_type = 'payment'`
   - `rentprog_id = rpPaymentId`
   - `company_id` (филиал)
   - Время в окне ±5 минут

2. Поиск записи в `history` по:
   - `branch`
   - `entity_type = 'payment'`
   - `entity_id = rpPaymentId`
   - Время в окне ±5 минут

3. Вычисление уверенности (`confidence`) на основе:
   - Наличия событий/истории
   - Разницы во времени
   - Совпадения ID

4. Создание связи в `event_links`

---

## 📡 API Endpoints

### POST `/event-links/payment/:paymentId`

Связать платеж с events и history вручную.

**Request:**
```json
{
  "branch": "tbilisi",
  "rpPaymentId": 1843216,
  "paymentDate": "2025-11-09T16:48:00.947+04:00",
  "timeWindowSeconds": 300
}
```

**Response:**
```json
{
  "ok": true,
  "result": {
    "created": true,
    "linkId": "uuid",
    "eventId": 123,
    "historyId": 456,
    "linkType": "all",
    "confidence": "high"
  }
}
```

### POST `/event-links/event/:eventId`

Связать событие с payments и history.

**Request:**
```json
{
  "branch": "tbilisi",
  "rpEntityId": "1843216",
  "entityType": "payment",
  "eventTime": "2025-11-09T16:48:00.947+04:00"
}
```

### GET `/event-links/payment/:paymentId`

Получить все связи для платежа.

**Response:**
```json
{
  "ok": true,
  "links": [
    {
      "id": "uuid",
      "entity_type": "payment",
      "event_id": 123,
      "payment_id": "uuid",
      "history_id": 456,
      "link_type": "all",
      "confidence": "high"
    }
  ]
}
```

### GET `/event-links/stats`

Статистика связей.

**Response:**
```json
{
  "ok": true,
  "stats": [
    {
      "entity_type": "payment",
      "link_type": "all",
      "confidence": "high",
      "matched_by": "auto",
      "total_links": 150,
      "unique_entities": 120
    }
  ]
}
```

### GET `/event-links/unlinked`

Несвязанные записи за последние 7 дней (через SQL view `unlinked_records`).

**Response:**
```json
{
  "ok": true,
  "unlinked": [
    {
      "source_table": "payment",
      "record_id": "uuid",
      "branch": "tbilisi",
      "rp_id": "1843216",
      "record_time": "2025-11-09T16:48:00.947+04:00"
    }
  ],
  "count": 10
}
```

---

## 📈 SQL Views

### `event_links_stats`

Статистика связей по типам, уверенности и источнику.

```sql
SELECT * FROM event_links_stats;
```

### `unlinked_records`

Записи без связей за последние 7 дней из всех трех таблиц.

```sql
SELECT * FROM unlinked_records;
```

---

## 🔍 Примеры использования

### Найти все связанные события для платежа

```sql
SELECT 
  e.id as event_id,
  e.type as event_type,
  e.ts as event_time,
  p.id as payment_id,
  p.amount,
  h.id as history_id,
  h.operation_type
FROM event_links el
LEFT JOIN events e ON el.event_id = e.id
LEFT JOIN payments p ON el.payment_id = p.id
LEFT JOIN history h ON el.history_id = h.id
WHERE el.payment_id = '...'
ORDER BY e.ts, h.created_at;
```

### Найти платежи без связанных событий

```sql
SELECT p.*
FROM payments p
LEFT JOIN event_links el ON el.payment_id = p.id
WHERE el.id IS NULL
  AND p.created_at > NOW() - INTERVAL '24 hours';
```

### Статистика связей по филиалам

```sql
SELECT 
  el.link_type,
  el.confidence,
  COUNT(*) as count,
  p.branch
FROM event_links el
JOIN payments p ON el.payment_id = p.id
GROUP BY el.link_type, el.confidence, p.branch
ORDER BY count DESC;
```

---

## 🚀 План внедрения

- [x] Создать миграцию для таблицы `event_links`
- [x] Добавить схему в Drizzle ORM
- [x] Создать функцию автоматического связывания
- [x] Интегрировать в процесс сохранения платежей
- [x] Создать API endpoints
- [ ] Добавить мониторинг несвязанных записей (workflow)
- [ ] Добавить автоматическое связывание для events и history

---

## 📝 Примечания

- Связывание происходит автоматически при сохранении платежей через `savePaymentFromRentProg()`
- Окно времени по умолчанию: ±5 минут (300 секунд)
- Если связывание не удалось - это не критично, логируется предупреждение
- Можно связать вручную через API endpoints
- View `unlinked_records` помогает найти записи без связей для ручного анализа

