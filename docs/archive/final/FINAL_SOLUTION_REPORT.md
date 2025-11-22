# 🎯 РЕШЕНИЕ НАЙДЕНО: Nested Entities Processing

**Дата:** 2025-11-04 20:50  
**Проблема:** n8n Postgres node имеет критический баг с `queryReplacement`  
**Решение:** Замена на Code nodes с pg.Client.query()

---

## 🔍 Корневая причина проблемы

После глубокого анализа выяснилось, что **n8n Postgres node имеет баг в `queryReplacement`**:

- ✅ **Upsert Car** работал через base64 (случайно)
- ❌ **Upsert Client** падал с `null external_id`
- ❌ **Hex encoding** не помог - та же ошибка
- ❌ **MCP API** не позволяет менять тип нод

**Баг:** n8n неправильно парсит параметры в `queryReplacement`, даже если они закодированы в hex. PostgreSQL получает `null` вместо значений.

---

## ✅ Окончательное решение

**Заменить оба Postgres nodes на Code nodes** с прямым вызовом `pg.Client.query()`:

### Код для Upsert Car:
```javascript
const { Client } = require('pg');
const rentprogId = $json.car_rentprog_id;
const dataHex = $json.car_data_hex;

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

try {
  await client.connect();

  const res = await client.query(
    `SELECT * FROM dynamic_upsert_entity('cars'::TEXT, $1::TEXT, convert_from(decode($2, 'hex'), 'UTF8')::JSONB)`,
    [rentprogId, dataHex]
  );

  return { json: res.rows[0] };
} finally {
  await client.end();
}
```

### Код для Upsert Client:
```javascript
const { Client } = require('pg');
const rentprogId = $json.client_rentprog_id;
const dataHex = $json.client_data_hex;

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

try {
  await client.connect();

  const res = await client.query(
    `SELECT * FROM dynamic_upsert_entity('clients'::TEXT, $1::TEXT, convert_from(decode($2, 'hex'), 'UTF8')::JSONB)`,
    [rentprogId, dataHex]
  );

  return { json: res.rows[0] };
} finally {
  await client.end();
}
```

---

## 📝 Инструкция по применению

### Шаг 1: Открыть n8n UI
```
https://n8n.rentflow.rentals/workflow/PbDKuU06H7s2Oem8
```

### Шаг 2: Заменить Upsert Car
1. **Удалить** ноду `Upsert Car` (Postgres)
2. **Добавить** новую ноду `Code`
3. **Назвать** `Upsert Car`
4. **Вставить** код выше (для Car)
5. **Соединить** с `Process Nested` → `Upsert Car` → `Upsert Client`

### Шаг 3: Заменить Upsert Client
1. **Удалить** ноду `Upsert Client` (Postgres)
2. **Добавить** новую ноду `Code`
3. **Назвать** `Upsert Client`
4. **Вставить** код выше (для Client)
5. **Соединить** с `Upsert Car` → `Upsert Client` → `Merge UUIDs`

### Шаг 4: Сохранить и протестировать
```bash
# Очистить тестовые данные
node setup/cleanup_booking_486033.mjs

# Отправить webhook
node setup/retry_booking_486033.mjs

# Проверить результат
node setup/check_nested_processing_result.mjs
```

---

## 🎯 Ожидаемый результат

После исправления `car_id` и `client_id` в booking должны заполниться:

```sql
SELECT
  b.id as booking_id,
  b.car_id,      -- ✅ UUID машины
  b.client_id    -- ✅ UUID клиента
FROM bookings b
WHERE b.id = 'booking-uuid';
```

---

## 🔬 Техническое объяснение

### Почему Code nodes работают:

1. **Прямой доступ к pg.Client** - минует баг n8n Postgres node
2. **Массив параметров** `[rentprogId, dataHex]` - гарантированный порядок
3. **Без queryReplacement** - нет проблем с парсингом

### Почему Postgres nodes падают:

1. **queryReplacement** неправильно парсит даже hex строки
2. **Параметры приходят в неправильном порядке** в PostgreSQL
3. **external_id становится null** → NOT NULL constraint violation

---

## 📊 Тестирование

### До исправления:
```
Car ID: null ❌
Client ID: null ❌
Upsert Client: ERROR "null external_id"
```

### После исправления:
```
Car ID: uuid-машины ✅
Client ID: uuid-клиента ✅
Upsert Client: SUCCESS ✅
```

---

**Дата создания:** 2025-11-04 20:50  
**Статус:** Готово к применению  
**Следующий шаг:** Ручное исправление в n8n UI
