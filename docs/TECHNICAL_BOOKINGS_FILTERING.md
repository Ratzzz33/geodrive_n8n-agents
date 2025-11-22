# 🔧 Различение технических броней в БД

**Дата:** 2025-01-18  
**Статус:** ✅ Готово к использованию

---

## 📋 Структура полей в таблице `bookings`

В таблице `bookings` есть три поля для различения типов броней:

```sql
-- Флаг технической брони
is_technical BOOLEAN DEFAULT FALSE

-- Тип брони
technical_type TEXT DEFAULT 'regular'
-- Значения:
--   'regular' - обычная клиентская бронь
--   'technical' - служебная поездка (сотрудник)
--   'technical_repair' - техническая бронь для ремонта

-- Цель технической брони
technical_purpose TEXT
-- Значения:
--   'repair' - для ремонта
--   'employee_trip' - служебная поездка
--   'service' - обслуживание
```

---

## 🎯 Логика определения

### Автоматическое определение при парсинге

```javascript
function getTechnicalType(attrs) {
  const clientName = `${attrs.first_name} ${attrs.last_name}`.toLowerCase();
  const description = (attrs.description || '').toLowerCase();
  
  // Не техническая
  if (!clientName.includes('сервис') && !clientName.includes('сотрудник')) {
    return { 
      is_technical: false, 
      technical_type: 'regular' 
    };
  }
  
  // Для ремонта
  if (clientName.includes('сервис') || description.includes('ремонт')) {
    return { 
      is_technical: true, 
      technical_type: 'technical_repair',
      technical_purpose: 'repair'
    };
  }
  
  // Служебная поездка
  return { 
    is_technical: true, 
    technical_type: 'technical',
    technical_purpose: 'employee_trip'
  };
}
```

---

## 🔍 Как отличить в SQL запросах

### 1. Техническая бронь для ремонта (машина НЕДОСТУПНА)

```sql
-- Брони для ремонта
SELECT * FROM bookings
WHERE technical_type = 'technical_repair'
  AND is_technical = TRUE;
```

**Признаки:**
- `technical_type = 'technical_repair'`
- `technical_purpose = 'repair'`
- `client_name` содержит "Сервис" или `description` содержит "ремонт"

**Влияние на доступность:** Машина **НЕДОСТУПНА** для аренды клиентам.

---

### 2. Служебная техническая бронь (машина МОЖЕТ быть доступна)

```sql
-- Служебные поездки
SELECT * FROM bookings
WHERE technical_type = 'technical'
  AND is_technical = TRUE
  AND technical_purpose = 'employee_trip';
```

**Признаки:**
- `technical_type = 'technical'`
- `technical_purpose = 'employee_trip'`
- `client_name` содержит "Сотрудник"

**Влияние на доступность:** Машина **МОЖЕТ быть доступна**, если не занята в этот период.

---

### 3. Обычная клиентская бронь

```sql
-- Клиентские брони
SELECT * FROM bookings
WHERE is_technical = FALSE
  OR technical_type = 'regular';
```

**Признаки:**
- `is_technical = FALSE`
- `technical_type = 'regular'` или `NULL`

**Влияние на доступность:** Машина **НЕДОСТУПНА** для других клиентов в этот период.

---

## 🚗 Использование в поиске доступных машин

### Вариант 1: Исключить ВСЕ технические брони (строгий фильтр)

```sql
-- Исключаем ВСЕ технические брони (и для ремонта, и служебные)
AND NOT EXISTS (
  SELECT 1
  FROM bookings b
  WHERE b.car_id = c.id
    AND b.is_technical = TRUE  -- Все технические
    AND (
      b.state = ANY($9::text[])
      OR (b.state IS NULL AND b.status IN ('active', 'confirmed', 'in_rent', 'Активная', 'Новая', 'Подтверждена'))
    )
    AND (
      (${bookingStartExpr}) < $11::timestamptz 
      AND (${bookingEndExpr}) > $10::timestamptz
    )
)
```

**Когда использовать:**
- Поиск для клиентов (строгий режим)
- Исключаем все технические брони, даже служебные

---

### Вариант 2: Исключить ТОЛЬКО брони для ремонта (мягкий фильтр)

```sql
-- Исключаем ТОЛЬКО брони для ремонта
-- Служебные поездки НЕ блокируют машину
AND NOT EXISTS (
  SELECT 1
  FROM bookings b
  WHERE b.car_id = c.id
    AND b.technical_type = 'technical_repair'  -- Только для ремонта
    AND (
      b.state = ANY($9::text[])
      OR (b.state IS NULL AND b.status IN ('active', 'confirmed', 'in_rent', 'Активная', 'Новая', 'Подтверждена'))
    )
    AND (
      (${bookingStartExpr}) < $11::timestamptz 
      AND (${bookingEndExpr}) > $10::timestamptz
    )
)
```

**Когда использовать:**
- Поиск для клиентов (мягкий режим)
- Служебные поездки не блокируют машину
- Только ремонты делают машину недоступной

---

### Вариант 3: Исключить клиентские и ремонтные, но разрешить служебные

```sql
-- Исключаем клиентские и ремонтные брони
-- Разрешаем служебные (если они не пересекаются)
AND NOT EXISTS (
  SELECT 1
  FROM bookings b
  WHERE b.car_id = c.id
    AND (
      -- Клиентские брони
      (b.is_technical = FALSE OR b.technical_type = 'regular')
      -- ИЛИ брони для ремонта
      OR b.technical_type = 'technical_repair'
    )
    AND (
      b.state = ANY($9::text[])
      OR (b.state IS NULL AND b.status IN ('active', 'confirmed', 'in_rent', 'Активная', 'Новая', 'Подтверждена'))
    )
    AND (
      (${bookingStartExpr}) < $11::timestamptz 
      AND (${bookingEndExpr}) > $10::timestamptz
    )
)
```

**Когда использовать:**
- Гибридный режим
- Служебные поездки не блокируют, но учитываются при проверке пересечений

---

## 📊 Примеры SQL запросов

### Статистика по типам броней

```sql
SELECT 
  technical_type,
  technical_purpose,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE state IN ('Активная', 'Новая', 'Подтверждена')) as active_count
FROM bookings
WHERE is_technical = TRUE
GROUP BY technical_type, technical_purpose
ORDER BY count DESC;
```

**Результат:**
```
technical_type      | technical_purpose | count | active_count
--------------------|-------------------|-------|-------------
technical_repair    | repair            | 45    | 12
technical           | employee_trip     | 120   | 8
```

---

### Машины в ремонте (недоступны)

```sql
SELECT DISTINCT
  c.plate,
  c.model,
  b.start_date,
  b.end_date,
  b.description
FROM cars c
INNER JOIN bookings b ON b.car_id = c.id
WHERE b.technical_type = 'technical_repair'
  AND b.state IN ('Активная', 'Новая', 'Подтверждена')
  AND b.start_date <= CURRENT_DATE
  AND b.end_date >= CURRENT_DATE
ORDER BY c.plate;
```

---

### Служебные поездки (не блокируют машину для клиентов)

```sql
SELECT 
  c.plate,
  c.model,
  b.start_date,
  b.end_date,
  b.client_name,
  b.description
FROM cars c
INNER JOIN bookings b ON b.car_id = c.id
WHERE b.technical_type = 'technical'
  AND b.technical_purpose = 'employee_trip'
  AND b.state IN ('Активная', 'Новая', 'Подтверждена')
  AND b.start_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY b.start_date DESC;
```

---

## 🎯 Рекомендации для бота поиска

### Для поиска доступных машин клиентам:

**Используйте Вариант 2** (исключать только `technical_repair`):

```sql
-- В функции searchCars() добавьте фильтр:
AND NOT EXISTS (
  SELECT 1
  FROM bookings b
  WHERE b.car_id = c.id
    AND b.technical_type = 'technical_repair'  -- Только ремонты блокируют
    AND (
      b.state = ANY($9::text[])
      OR (b.state IS NULL AND b.status IN ('active', 'confirmed', 'in_rent', 'Активная', 'Новая', 'Подтверждена'))
    )
    AND (
      (${bookingStartExpr}) < $11::timestamptz 
      AND (${bookingEndExpr}) > $10::timestamptz
    )
)
```

**Почему:**
- ✅ Служебные поездки не должны блокировать машину для клиентов
- ✅ Только ремонты делают машину недоступной
- ✅ Больше машин доступно для аренды

---

## ⚠️ Важные замечания

1. **Проверка полей:**
   ```sql
   -- Убедитесь, что поля существуют
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'bookings' 
     AND column_name IN ('is_technical', 'technical_type', 'technical_purpose');
   ```

2. **Миграция данных:**
   - Если поля отсутствуют, выполните миграцию: `setup/add_technical_booking_fields.sql`
   - После миграции перезапустите парсинг броней для заполнения полей

3. **Обновление существующих записей:**
   ```sql
   -- Обновить существующие брони на основе client_name
   UPDATE bookings
   SET 
     is_technical = TRUE,
     technical_type = CASE
       WHEN LOWER(client_name) LIKE '%сервис%' OR LOWER(description) LIKE '%ремонт%' 
         THEN 'technical_repair'
       WHEN LOWER(client_name) LIKE '%сотрудник%' OR LOWER(client_name) LIKE '%employee%' 
         THEN 'technical'
       ELSE 'regular'
     END
   WHERE 
     LOWER(client_name) LIKE '%сервис%' OR 
     LOWER(client_name) LIKE '%сотрудник%' OR
     LOWER(client_name) LIKE '%service%' OR
     LOWER(client_name) LIKE '%employee%';
   ```

---

## 📚 Связанные документы

- [TECHNICAL_BOOKINGS_INTEGRATION.md](./TECHNICAL_BOOKINGS_INTEGRATION.md) - Полная интеграция технических броней
- [setup/add_technical_booking_fields.sql](../setup/add_technical_booking_fields.sql) - Миграция БД
- [docs/EXTERNAL_BOT_DATABASE_ACCESS.md](./EXTERNAL_BOT_DATABASE_ACCESS.md) - Доступ к БД для внешних ботов

---

**Дата создания:** 2025-01-18  
**Версия:** 1.0.0

