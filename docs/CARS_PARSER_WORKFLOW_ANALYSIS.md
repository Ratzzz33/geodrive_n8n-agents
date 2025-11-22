# 🔍 Анализ Workflow: Парсинг автомобилей раз в 5 min

**Workflow ID:** `u3cOUuoaH5RSw7hm`  
**URL:** https://n8n.rentflow.rentals/workflow/u3cOUuoaH5RSw7hm  
**Дата анализа:** 2025-01-21

---

## 📋 СТРУКТУРА WORKFLOW

### Основной поток:
1. **Every 5 min** (Schedule Trigger) → запускает 4 ветки параллельно
2. **Tbilisi/Batumi/Kutaisi/Service Pages** → подготавливают параметры для запросов
3. **Get Tbilisi/Batumi/Kutaisi/Service** → HTTP запросы к RentProg API
4. **Set Branch** → устанавливают branch и branch_id
5. **Wait for All Branches** → объединяет результаты всех филиалов
6. **Merge & Process** → парсит данные из API, извлекает цены
7. **Split Cars and Prices** → разделяет машины и цены
8. **Save Snapshot** → сохраняет snapshot в `rentprog_car_states_snapshot`
9. **Find Car ID** → находит car_id для цен
10. **Merge Car ID** → объединяет car_id с данными о ценах
11. **Format Price Values** → форматирует структуру цен
12. **Save Prices** → сохраняет цены в `car_prices`

---

## ⚠️ КРИТИЧЕСКИЕ ПРОБЛЕМЫ

### 1. ❌ ЗАТИРАНИЕ ДАННЫХ ПУСТЫМИ ЗНАЧЕНИЯМИ

#### Проблема в ноде "Save Snapshot" (строка 613-660)

**Текущий SQL:**
```sql
ON CONFLICT ON CONSTRAINT rentprog_car_states_snapshot_pkey
DO UPDATE SET
  car_name = EXCLUDED.car_name,
  code = EXCLUDED.code,
  vin = EXCLUDED.vin,
  ...
```

**Проблемы:**
1. **НЕТ защиты от пустых строк** - если `EXCLUDED.car_name = ''`, то существующее значение будет затерто
2. **НЕТ защиты от NULL** - если `EXCLUDED.vin = NULL`, то существующее значение будет затерто
3. **NULLIF($X, 'null')** защищает только от строки `'null'`, но НЕ от:
   - Пустых строк `''`
   - Реального `null`
   - `undefined` (который может стать пустой строкой)

**Пример проблемы:**
```javascript
// В ноде "Merge & Process" (строка 342):
vin: attrs.vin,  // Если attrs.vin = undefined, то vin = undefined
```

При передаче в SQL через `queryReplacement`:
- `undefined` → становится пустой строкой `''` или `null`
- `NULLIF($6, 'null')` → НЕ защищает от пустой строки
- `DO UPDATE SET vin = EXCLUDED.vin` → затирает существующее значение

**Решение:**
Использовать `COALESCE` в `DO UPDATE SET`:
```sql
DO UPDATE SET
  car_name = COALESCE(NULLIF(EXCLUDED.car_name, ''), tgt.car_name),
  code = COALESCE(NULLIF(EXCLUDED.code, ''), tgt.code),
  vin = COALESCE(NULLIF(EXCLUDED.vin, ''), tgt.vin),
  ...
```

---

### 2. ⚠️ ПАРСИНГ МАШИН - ЧАСТИЧНАЯ ПРОВЕРКА

#### Нода "Merge & Process" (строка 342)

**Проверка наличия данных:**
```javascript
if (carsData.length === 0) {
  results.push({
    json: {
      branch_code: branchCode,
      branch_id: branchId,
      error: true,
      error_message: 'No cars data in response'
    }
  });
  continue;
}
```

**✅ ХОРОШО:**
- Проверяет наличие данных
- Обрабатывает все машины из массива (нет фильтрации)
- Поддерживает разные форматы ответа API (JSON:API, обычный массив)

**⚠️ ПОТЕНЦИАЛЬНЫЕ ПРОБЛЕМЫ:**
1. **Нет проверки на `carId`** - если `carId` отсутствует, машина все равно будет обработана:
   ```javascript
   const carId = attrs.id || car.id;  // Может быть undefined
   ```
   Но это не критично, т.к. `rentprog_id` обязателен для сохранения.

2. **Нет фильтрации по филиалу** - все машины из ответа обрабатываются, даже если они не относятся к текущему филиалу. Это может быть проблемой, если API возвращает машины всех филиалов.

---

### 3. ✅ ПАРСИНГ ЦЕН - ПРАВИЛЬНО РЕАЛИЗОВАНО

#### Нода "Merge & Process" (строка 342)

**Извлечение цен:**
```javascript
// Извлекаем included (цены и сезоны)
const included = responseData.included || [];
const prices = included.filter(item => item.type === 'price');
const seasons = included.filter(item => item.type === 'season');

// Создаем маппинг цен по car_id
const pricesByCarId = {};
for (const price of prices) {
  const carId = price.attributes?.car_id;
  const seasonId = price.attributes?.season_id;
  if (carId) {
    if (!pricesByCarId[carId]) {
      pricesByCarId[carId] = [];
    }
    pricesByCarId[carId].push({
      id: price.id,
      season_id: seasonId,
      values: price.attributes?.values || []
    });
  }
}
```

**✅ ХОРОШО:**
- Правильно извлекает цены из `included` секции (JSON:API формат)
- Создает маппинг по `car_id`
- Обрабатывает все цены для каждой машины
- Сохраняет `season_id` для сезонных цен

**Поток сохранения цен:**
1. **Split Cars and Prices** → разделяет машины и цены по наличию `price_id`
2. **Find Car ID** → находит `car_id` по `rentprog_id` из таблицы `cars`
3. **Merge Car ID** → объединяет `car_id` с данными о ценах
4. **Format Price Values** → форматирует структуру цен
5. **Save Prices** → сохраняет в `car_prices` через upsert

**⚠️ ПОТЕНЦИАЛЬНАЯ ПРОБЛЕМА:**
- Если машина не найдена в таблице `cars` (только в snapshot), то цены не будут сохранены:
  ```javascript
  if (!carIdResult || !carIdResult.car_id) {
    return [];  // Пропускаем запись
  }
  ```
  Это может быть проблемой, если workflow сохраняет только в snapshot, а не в основную таблицу `cars`.

---

### 4. ⚠️ ОТСУТСТВИЕ СОХРАНЕНИЯ В ОСНОВНУЮ ТАБЛИЦУ `cars`

**Проблема:**
Workflow сохраняет данные **ТОЛЬКО** в `rentprog_car_states_snapshot` (snapshot таблица), но **НЕ** в основную таблицу `cars`.

**Последствия:**
1. Данные недоступны для агентов, которые работают с таблицей `cars`
2. Цены не могут быть сохранены, т.к. `Find Car ID` ищет машину в таблице `cars`:
   ```sql
   SELECT c.id as car_id
   FROM cars c
   WHERE c.rentprog_id = '={{ $json.rentprog_id }}'
   ```
   Если машины нет в `cars`, то `car_id` не будет найден, и цены не сохранятся.

**Решение:**
Добавить ноду для сохранения в основную таблицу `cars` через `dynamic_upsert_entity`:
```sql
SELECT * FROM dynamic_upsert_entity(
  'cars'::TEXT,
  $1::TEXT,  -- rentprog_id
  $2::JSONB  -- data
);
```

---

## 📊 ДЕТАЛЬНЫЙ АНАЛИЗ НОД

### ✅ Нода "Merge & Process" (строка 342)

**Функции:**
- Парсит данные из API ответа
- Извлекает цены из `included` секции
- Создает маппинг цен по `car_id`
- Обрабатывает все машины без фильтрации

**Парсимые поля (46 полей):**
- Основные: `rentprog_id`, `car_name`, `code`, `number`
- Характеристики: `vin`, `color`, `year`, `transmission`, `fuel`, `car_type`, `car_class`
- Состояния: `active`, `state`, `tank_state`, `clean_state`
- Пробег и ТО: `mileage`, `tire_type`, `tire_size`, `last_inspection`
- Цены и финансы: `deposit`, `price_hour`, `hourly_deposit`, `monthly_deposit`, `investor_id`, `purchase_price`, `purchase_date`
- Ограничения: `age_limit`, `driver_year_limit`, `franchise`, `max_fine`, `repair_cost`
- Опции: `is_air`, `climate_control`, `parktronic`, `parktronic_camera`, `heated_seats`, `audio_system`, `usb_system`, `rain_sensor`
- Технические: `engine_capacity`, `number_doors`, `tank_value`
- Документы: `pts`, `registration_certificate`, `body_number`
- Полный JSON: `data` (JSONB)

**✅ ХОРОШО:**
- Парсит все 46 полей
- Правильно обрабатывает JSON:API формат
- Извлекает цены из `included`

**⚠️ ПРОБЛЕМЫ:**
- Нет фильтрации `undefined` значений перед передачей в SQL
- Может передавать пустые строки, которые затирают существующие данные

---

### ❌ Нода "Save Snapshot" (строка 613)

**Функции:**
- Сохраняет snapshot в `rentprog_car_states_snapshot`
- Использует `ON CONFLICT DO UPDATE` для обновления существующих записей

**Проблемы:**
1. **Затирание данных пустыми значениями:**
   ```sql
   DO UPDATE SET
     car_name = EXCLUDED.car_name,  -- Затирает, если EXCLUDED.car_name = '' или NULL
     vin = EXCLUDED.vin,            -- Затирает, если EXCLUDED.vin = '' или NULL
     ...
   ```

2. **Недостаточная защита от NULL:**
   ```sql
   NULLIF($3, 'null')::text  -- Защищает только от строки 'null', не от пустой строки или реального NULL
   ```

**Решение:**
Использовать `COALESCE` в `DO UPDATE SET`:
```sql
DO UPDATE SET
  car_name = COALESCE(NULLIF(EXCLUDED.car_name, ''), tgt.car_name),
  code = COALESCE(NULLIF(EXCLUDED.code, ''), tgt.code),
  vin = COALESCE(NULLIF(EXCLUDED.vin, ''), tgt.vin),
  ...
```

---

### ✅ Нода "Save Prices" (строка 526)

**Функции:**
- Сохраняет цены в `car_prices` через upsert
- Использует `matchingColumns: ['car_id', 'season_id']` для определения конфликта

**✅ ХОРОШО:**
- Правильно использует upsert
- Сохраняет `rentprog_price_id`, `season_id`, `price_values`
- Не затирает данные, т.к. использует upsert (обновляет только при конфликте)

**⚠️ ПОТЕНЦИАЛЬНАЯ ПРОБЛЕМА:**
- Если `car_id` не найден (машина не в таблице `cars`), цены не сохранятся

---

### ✅ Нода "Format Price Values" (строка 577)

**Функции:**
- Форматирует структуру цен для сохранения
- Создает структуру с периодами, значениями, валютой

**✅ ХОРОШО:**
- Правильно форматирует структуру цен
- Обрабатывает пустые массивы `values || []`
- Пропускает записи без `car_id`

---

## 🎯 ИТОГОВАЯ ОЦЕНКА

### ✅ ЧТО РАБОТАЕТ ПРАВИЛЬНО:
1. ✅ Парсит все машины (нет фильтрации)
2. ✅ Парсит все цены из `included` секции
3. ✅ Правильно обрабатывает JSON:API формат
4. ✅ Сохраняет 46 полей + полный JSON в `data`
5. ✅ Правильно сохраняет цены в `car_prices`

### ❌ КРИТИЧЕСКИЕ ПРОБЛЕМЫ:
1. ❌ **ЗАТИРАНИЕ ДАННЫХ ПУСТЫМИ ЗНАЧЕНИЯМИ** в ноде "Save Snapshot"
   - Нет защиты от пустых строк `''`
   - Нет защиты от `NULL` в `DO UPDATE SET`
   - Используется только `NULLIF($X, 'null')`, что недостаточно

2. ❌ **ОТСУТСТВИЕ СОХРАНЕНИЯ В ОСНОВНУЮ ТАБЛИЦУ `cars`**
   - Данные сохраняются только в snapshot
   - Цены не могут быть сохранены, если машины нет в `cars`
   - Данные недоступны для агентов

### ⚠️ ПОТЕНЦИАЛЬНЫЕ ПРОБЛЕМЫ:
1. ⚠️ Нет фильтрации `undefined` значений в ноде "Merge & Process"
2. ⚠️ Нет проверки на наличие `car_id` перед сохранением цен

---

## 🔧 РЕКОМЕНДАЦИИ ПО ИСПРАВЛЕНИЮ

### 1. Исправить затирание данных в "Save Snapshot"

**Изменить `DO UPDATE SET` на:**
```sql
DO UPDATE SET
  branch_id = EXCLUDED.branch_id,
  car_name = COALESCE(NULLIF(EXCLUDED.car_name, ''), tgt.car_name),
  code = COALESCE(NULLIF(EXCLUDED.code, ''), tgt.code),
  number = COALESCE(NULLIF(EXCLUDED.number, ''), tgt.number),
  vin = COALESCE(NULLIF(EXCLUDED.vin, ''), tgt.vin),
  color = COALESCE(NULLIF(EXCLUDED.color, ''), tgt.color),
  year = COALESCE(EXCLUDED.year, tgt.year),
  transmission = COALESCE(NULLIF(EXCLUDED.transmission, ''), tgt.transmission),
  fuel = COALESCE(NULLIF(EXCLUDED.fuel, ''), tgt.fuel),
  car_type = COALESCE(NULLIF(EXCLUDED.car_type, ''), tgt.car_type),
  car_class = COALESCE(NULLIF(EXCLUDED.car_class, ''), tgt.car_class),
  active = COALESCE(EXCLUDED.active, tgt.active),
  state = COALESCE(NULLIF(EXCLUDED.state, ''), tgt.state),
  tank_state = COALESCE(EXCLUDED.tank_state, tgt.tank_state),
  clean_state = COALESCE(EXCLUDED.clean_state, tgt.clean_state),
  mileage = COALESCE(EXCLUDED.mileage, tgt.mileage),
  tire_type = COALESCE(EXCLUDED.tire_type, tgt.tire_type),
  tire_size = COALESCE(NULLIF(EXCLUDED.tire_size, ''), tgt.tire_size),
  last_inspection = COALESCE(NULLIF(EXCLUDED.last_inspection, ''), tgt.last_inspection),
  deposit = COALESCE(EXCLUDED.deposit, tgt.deposit),
  price_hour = COALESCE(EXCLUDED.price_hour, tgt.price_hour),
  hourly_deposit = COALESCE(EXCLUDED.hourly_deposit, tgt.hourly_deposit),
  monthly_deposit = COALESCE(EXCLUDED.monthly_deposit, tgt.monthly_deposit),
  investor_id = COALESCE(EXCLUDED.investor_id, tgt.investor_id),
  purchase_price = COALESCE(EXCLUDED.purchase_price, tgt.purchase_price),
  purchase_date = COALESCE(NULLIF(EXCLUDED.purchase_date, ''), tgt.purchase_date),
  age_limit = COALESCE(EXCLUDED.age_limit, tgt.age_limit),
  driver_year_limit = COALESCE(EXCLUDED.driver_year_limit, tgt.driver_year_limit),
  franchise = COALESCE(EXCLUDED.franchise, tgt.franchise),
  max_fine = COALESCE(EXCLUDED.max_fine, tgt.max_fine),
  repair_cost = COALESCE(EXCLUDED.repair_cost, tgt.repair_cost),
  is_air = COALESCE(EXCLUDED.is_air, tgt.is_air),
  climate_control = COALESCE(EXCLUDED.climate_control, tgt.climate_control),
  parktronic = COALESCE(EXCLUDED.parktronic, tgt.parktronic),
  parktronic_camera = COALESCE(EXCLUDED.parktronic_camera, tgt.parktronic_camera),
  heated_seats = COALESCE(EXCLUDED.heated_seats, tgt.heated_seats),
  audio_system = COALESCE(EXCLUDED.audio_system, tgt.audio_system),
  usb_system = COALESCE(EXCLUDED.usb_system, tgt.usb_system),
  rain_sensor = COALESCE(EXCLUDED.rain_sensor, tgt.rain_sensor),
  engine_capacity = COALESCE(NULLIF(EXCLUDED.engine_capacity, ''), tgt.engine_capacity),
  number_doors = COALESCE(EXCLUDED.number_doors, tgt.number_doors),
  tank_value = COALESCE(EXCLUDED.tank_value, tgt.tank_value),
  pts = COALESCE(NULLIF(EXCLUDED.pts, ''), tgt.pts),
  registration_certificate = COALESCE(NULLIF(EXCLUDED.registration_certificate, ''), tgt.registration_certificate),
  body_number = COALESCE(NULLIF(EXCLUDED.body_number, ''), tgt.body_number),
  company_id = COALESCE(NULLIF(EXCLUDED.company_id, ''), tgt.company_id),
  data = COALESCE(EXCLUDED.data, tgt.data),
  fetched_at = NOW()
```

### 2. Добавить фильтрацию `undefined` в "Merge & Process"

**Изменить код на:**
```javascript
// Фильтруем undefined, null, пустые строки
const safeValue = (value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;  // Не передаем в SQL
  }
  return value;
};

results.push({
  json: {
    branch_code: branchCode,
    branch_id: branchId,
    rentprog_id: carId,
    car_name: safeValue(attrs.car_name || attrs.name),
    code: safeValue(attrs.code),
    number: safeValue(attrs.number),
    vin: safeValue(attrs.vin),
    // ... остальные поля
  }
});
```

### 3. Добавить сохранение в основную таблицу `cars`

**Добавить ноду после "Save Snapshot":**
```sql
SELECT * FROM dynamic_upsert_entity(
  'cars'::TEXT,
  $1::TEXT,  -- rentprog_id
  $2::JSONB  -- data
);
```

---

## 📝 ЗАКЛЮЧЕНИЕ

Workflow **правильно парсит все машины и цены**, но имеет **критическую проблему с затиранием данных пустыми значениями** в ноде "Save Snapshot". Также отсутствует сохранение в основную таблицу `cars`, что может привести к проблемам с сохранением цен.

**Приоритет исправлений:**
1. 🔴 **КРИТИЧНО:** Исправить затирание данных в "Save Snapshot"
2. 🟡 **ВАЖНО:** Добавить сохранение в основную таблицу `cars`
3. 🟢 **ЖЕЛАТЕЛЬНО:** Добавить фильтрацию `undefined` в "Merge & Process"

