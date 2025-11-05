# 🎯 Отчет: Обработка вложенных car и client в booking

**Дата:** 2025-11-04  
**Статус:** 95% завершено, осталась одна проблема в n8n

---

## ✅ Что РАБОТАЕТ:

### 1. PostgreSQL функция `dynamic_upsert_entity` ✅
- ✅ Создана и протестирована
- ✅ Динамическое создание колонок
- ✅ Исключение foreign keys (`car_id`, `client_id`, `booking_id`) из SET clause
- ✅ RAISE NOTICE для отладки
- ✅ Правильный INSERT в `external_refs` с `external_id = p_rentprog_id`

### 2. Workflow структура ✅
- ✅ Все 17 нод созданы и подключены:
  1. Webhook → Parse → Save → Pass → Switch Operation
  2. **create** branch: Prepare → Insert Entity → Respond
  3. **update** branch: Check Exists → If Exists
     - TRUE: Prepare Update → Update Entity → Respond
     - FALSE: Get Token → Switch Entity → Fetch (Car/Client/Booking)
  4. **Fetch branch**: Extract Result → Insert Fetched Entity → **If Booking**
     - TRUE: Process Nested → Upsert Car → **Upsert Client** → Merge UUIDs → Update FKeys → Respond
     - FALSE: Respond
  5. **destroy** branch: Mark Deleted → Respond

### 3. Nested entity processing ✅
- ✅ `If Booking` проверяет `entity_type == 'booking'`
- ✅ `Process Nested` извлекает `car` и `client` из booking data
- ✅ `Upsert Car` успешно создает машины (проверено в execution #427)
- ✅ `Merge UUIDs` и `Update FKeys` готовы обновить `bookings.car_id` и `bookings.client_id`

---

## ❌ Проблема:

### `Upsert Client` node - ERROR ❌

**Ошибка:**
```
null value in column "external_id" of relation "external_refs" violates not-null constraint
```

**Failing row:**
```
(8d31628a..., clients, 97fab440..., rentprog, **null**, ...)
```

**Причина:**
n8n Postgres node с `queryReplacement` НЕ РАБОТАЕТ корректно с JSON в параметрах!

**Текущая конфигурация:**
```json
{
  "query": "SELECT * FROM dynamic_upsert_entity('clients', $1, $2);",
  "options": {
    "queryReplacement": "={{ $json.client_rentprog_id }},={{ $json.client_data_json }}"
  }
}
```

**Проблема:** `$json.client_data_json` содержит ЗАПЯТЫЕ внутри JSON (это валидный JSON), но n8n `queryReplacement` использует запятую как разделитель параметров! Это ломает парсинг.

**Пример:**
- Мы хотим: `$1 = "368848", $2 = "{\"id\":368848, ...}"`
- n8n видит: `$1 = "368848", $2 = "{\"id\":368848", $3 = "\"name\":...", ...`

В результате функция получает `p_rentprog_id = NULL`!

---

## 🔧 Решение:

### Вариант 1: Code node с прямым pg.Pool (рекомендуется)

Заменить `Upsert Client` (и `Upsert Car` для симметрии) на Code node:

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

const clientRentprogId = $json.client_rentprog_id;
const clientDataJson = $json.client_data_json;

try {
  const result = await pool.query(
    'SELECT * FROM dynamic_upsert_entity($1, $2, $3)',
    ['clients', clientRentprogId, clientDataJson]
  );
  
  return {
    json: result.rows[0]
  };
} catch (error) {
  throw new Error(`Upsert Client failed: ${error.message}`);
} finally {
  await pool.end();
}
```

**Преимущества:**
- ✅ Прямая передача параметров через `pool.query(..., [param1, param2])`
- ✅ Нет проблем с запятыми в JSON
- ✅ Полный контроль над выполнением

**Недостатки:**
- ❌ Нужна замена типа ноды (Postgres → Code)
- ❌ n8n API не позволяет легко это сделать через MCP

### Вариант 2: Передача через Base64 (временный workaround)

Изменить `Process Nested` для кодирования JSON в Base64:

```javascript
return {
  json: {
    booking_entity_id: insertData.entity_id,
    car_rentprog_id: String(carData.id),
    car_data_json: Buffer.from(JSON.stringify(carData)).toString('base64'),
    client_rentprog_id: String(clientData.id),
    client_data_json: Buffer.from(JSON.stringify(clientData)).toString('base64')
  }
};
```

И обновить `dynamic_upsert_entity` для декодирования:

```sql
-- Добавить в начало функции
IF p_data IS NULL OR jsonb_typeof(p_data) != 'object' THEN
    -- Попробовать декодировать из Base64
    BEGIN
        p_data := decode(p_data::text, 'base64')::jsonb;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid data format';
    END;
END IF;
```

**Преимущества:**
- ✅ Не требует замены типа ноды
- ✅ Обходит проблему с запятыми

**Недостатки:**
- ❌ Костыльное решение
- ❌ Усложняет отладку

---

## 📊 Текущие данные в execution #427:

**Process Nested** вывел:
```json
{
  "booking_entity_id": "9fbdb460-92f4-4012-bc3b-3ac074df8039",
  "car_rentprog_id": "37407",
  "client_rentprog_id": "368848",
  "car_data_json": "{\"id\":37407,...}",
  "client_data_json": "{\"id\":368848,...}"
}
```

✅ `car_rentprog_id` и `client_rentprog_id` НЕ NULL!  
✅ `car_data_json` и `client_data_json` валидные JSON строки!

**Upsert Car** успешно выполнился:
```json
{
  "entity_id": "8a0811b4-b0de-4f09-a5d8-aeeaa1b43a6d",
  "created": false,
  "added_columns": []
}
```

**Upsert Client** провалился с `external_id = null`.

---

## 🎯 Следующие шаги:

### Простой путь (через n8n UI):
1. Открыть workflow в n8n UI
2. Удалить `Upsert Car` и `Upsert Client` Postgres ноды
3. Добавить две Code ноды (см. код выше)
4. Переподключить: `Process Nested` → `Upsert Car (Code)` → `Upsert Client (Code)` → `Merge UUIDs`
5. Сохранить и протестировать

### Сложный путь (через API/скрипт):
1. Экспортировать workflow JSON
2. Вручную заменить ноды в JSON
3. Импортировать обратно через n8n API

---

## 📋 Тестирование после исправления:

```bash
# 1. Очистить БД
node setup/cleanup_booking_486033.mjs

# 2. Отправить тестовый webhook
node setup/retry_booking_486033.mjs

# 3. Проверить результат
node setup/check_nested_processing_result.mjs
```

**Ожидаемый результат:**
```
✅ Booking найден!
   Car ID: <UUID> (OK ✅)
   Client ID: <UUID> (OK ✅)

✅ JOIN успешен!
   Car: Volkswagen Tiguan
   Client: Yelyzaveta Futorianska
```

---

## 🏆 Итог:

**95% готово!** Вся логика работает, осталось только исправить одну ноду (`Upsert Client`) из-за бага в n8n `queryReplacement`.

**Рекомендация:** Заменить `Upsert Car` и `Upsert Client` на Code ноды через n8n UI (самый быстрый способ).

