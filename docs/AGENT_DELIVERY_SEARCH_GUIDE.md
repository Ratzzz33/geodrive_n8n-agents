# Инструкция для агента поиска авто с доставкой

## Обзор

Агент должен искать свободные машины не только в текущем филиале клиента, но и в других филиалах, учитывая:
- **Будущий филиал** машины (куда она должна вернуться по следующей брони)
- **Стоимость доставки** из филиала машины в город клиента
- **Стоимость возврата** (для односторонней аренды) с учётом скидок
- **Доплату за нерабочее время** (выдача/приём вне 09:00-20:00)

## Основные понятия

### Филиалы машин

- **current_branch_id** — где машина находится сейчас
- **future_branch_id** — куда машина должна вернуться по ближайшей будущей брони
- **desired_branch_id** — куда хотим перегнать машину (автоматически или вручную)
- **home_branch_id** — родной филиал машины (если установлен)

**Важно:** При поиске машин для будущих дат используй **future_branch_id**, а не current_branch_id!

### Типы доставки

- **city** — внутри города ($10)
- **airport** — до аэропорта ($20)
- **intercity** — между городами (цена из `routes.xlsx`)

### Скидки на одностороннюю аренду

- **100% скидка** (бесплатно):
  - Возврат в `home_branch`
  - Возврат в `desired_branch`
  - До следующей брони <7 дней
- **50% скидка**:
  - До следующей брони 7-14 дней
- **0% скидка** (полная стоимость):
  - Все остальные случаи

### Доплата за нерабочее время

- **$20** за каждую операцию (выдача или возврат)
- **Рабочее время:** 09:00 - 20:00 (Asia/Tbilisi)
- **Нерабочее время:** до 09:00 или после 20:00

## Алгоритм поиска и расчёта

### Шаг 1: Определить целевой филиал/город клиента

```javascript
// Клиент хочет получить машину в городе "Тбилиси"
const targetCity = "Тбилиси";
const targetBranchCode = "tbilisi"; // или определить через cities

// Даты аренды
const issueDate = "2025-02-01 10:00:00+04";
const returnDate = "2025-02-05 18:00:00+04";
const isOneWay = false; // односторонняя аренда?
```

### Шаг 2: Найти свободные машины

**Важно:** Используй `future_branch_id` для поиска, если период аренды пересекает или идёт после следующей брони машины.

```sql
-- Поиск свободных машин с учётом будущего филиала
SELECT DISTINCT
  c.id AS car_id,
  c.plate AS car_plate,
  c.model AS car_model,
  
  -- Статусы филиалов
  COALESCE(cbs.future_branch_id, cbs.current_branch_id, c.branch_id) AS effective_branch_id,
  COALESCE(cbs.future_branch_code, cbs.current_branch_code, b.code) AS effective_branch_code,
  cbs.current_branch_id,
  cbs.current_branch_code,
  cbs.future_branch_id,
  cbs.future_branch_code,
  cbs.home_branch_id,
  cbs.desired_branch_id,
  cbs.days_until_future_booking,
  
  -- Проверка доступности
  CASE
    -- Если есть будущая бронь, которая начинается раньше или в тот же день
    WHEN cbs.future_booking_start_at IS NOT NULL 
         AND cbs.future_booking_start_at <= $1::TIMESTAMPTZ THEN
      cbs.future_branch_id
    -- Иначе используем текущий филиал
    ELSE COALESCE(cbs.current_branch_id, c.branch_id)
  END AS search_branch_id
  
FROM cars c
LEFT JOIN branches b ON c.branch_id = b.id
LEFT JOIN car_branch_states cbs ON c.id = cbs.car_id
LEFT JOIN bookings existing ON c.id = existing.car_id
  AND existing.status NOT IN ('cancelled', 'rejected', 'deleted')
  AND (
    (existing.start_at <= $1::TIMESTAMPTZ AND existing.end_at >= $1::TIMESTAMPTZ) OR
    (existing.start_at <= $2::TIMESTAMPTZ AND existing.end_at >= $2::TIMESTAMPTZ) OR
    (existing.start_at >= $1::TIMESTAMPTZ AND existing.end_at <= $2::TIMESTAMPTZ)
  )
WHERE existing.id IS NULL -- Нет пересекающихся броней
  AND c.available = TRUE
  AND (
    -- Машина в целевом филиале
    COALESCE(cbs.future_branch_id, cbs.current_branch_id, c.branch_id) = (
      SELECT id FROM branches WHERE code = $3
    )
    OR
    -- Или можно доставить из другого филиала
    EXISTS (
      SELECT 1 FROM city_delivery_pricing cdp
      WHERE cdp.delivery_branch_id = COALESCE(cbs.future_branch_id, cbs.current_branch_id, c.branch_id)
        AND cdp.city_id = (SELECT id FROM cities WHERE name = $4)
        AND cdp.is_active = TRUE
    )
  )
ORDER BY 
  -- Сначала машины в целевом филиале (без доставки)
  CASE WHEN COALESCE(cbs.future_branch_id, cbs.current_branch_id, c.branch_id) = 
            (SELECT id FROM branches WHERE code = $3) THEN 0 ELSE 1 END,
  c.plate;
```

**Параметры:**
- `$1` — `issueDate` (TIMESTAMPTZ)
- `$2` — `returnDate` (TIMESTAMPTZ)
- `$3` — `targetBranchCode` (TEXT)
- `$4` — `targetCity` (TEXT)

### Шаг 3: Получить данные о доставке для каждой машины

Используй VIEW `car_delivery_options_view`:

```sql
SELECT 
  car_id,
  car_plate,
  current_branch_code,
  future_branch_code,
  target_branch_code,
  delivery_scope,
  
  -- Стоимость доставки
  final_delivery_fee_usd,
  
  -- Стоимость возврата (для односторонней аренды)
  final_one_way_fee_usd,
  discount_percent,
  can_offer_without_fee,
  
  -- Доплата за нерабочее время (размер, не расчёт)
  out_of_hours_fee_usd,
  
  days_until_future_booking
  
FROM car_delivery_options_view
WHERE car_id = $1
  AND target_branch_code = $2;
```

**Параметры:**
- `$1` — `carId` (UUID)
- `$2` — `targetBranchCode` (TEXT)

### Шаг 4: Рассчитать доплату за нерабочее время

```sql
SELECT calculate_out_of_hours_fee(
  $1::TIMESTAMPTZ, -- issue_time
  $2::TIMESTAMPTZ  -- return_time
) AS out_of_hours_fee;
```

**Параметры:**
- `$1` — `issueDate` (TIMESTAMPTZ)
- `$2` — `returnDate` (TIMESTAMPTZ)

**Результат:** `0`, `20` или `40` (в зависимости от времени)

### Шаг 5: Рассчитать итоговую стоимость

```javascript
// Получаем данные о доставке
const deliveryData = await sql`
  SELECT 
    final_delivery_fee_usd,
    final_one_way_fee_usd,
    discount_percent,
    can_offer_without_fee,
    delivery_scope
  FROM car_delivery_options_view
  WHERE car_id = ${carId}
    AND target_branch_code = ${targetBranchCode}
`;

// Рассчитываем доплату за нерабочее время
const outOfHoursFee = await sql`
  SELECT calculate_out_of_hours_fee(
    ${issueDate}::TIMESTAMPTZ,
    ${returnDate}::TIMESTAMPTZ
  ) AS fee
`;

// Базовая стоимость аренды (из вашей системы)
const baseRentalPrice = 100; // USD

// Стоимость доставки
const deliveryFee = deliveryData.final_delivery_fee_usd || 0;

// Стоимость возврата (только для односторонней аренды)
const returnFee = isOneWay ? (deliveryData.final_one_way_fee_usd || 0) : 0;

// Доплата за нерабочее время
const outOfHoursFeeAmount = outOfHoursFee.fee || 0;

// Итоговая стоимость
const totalPrice = baseRentalPrice + deliveryFee + returnFee + outOfHoursFeeAmount;

// Формируем детализацию для клиента
const priceBreakdown = {
  baseRental: baseRentalPrice,
  delivery: {
    amount: deliveryFee,
    type: deliveryData.delivery_scope, // 'city', 'airport', 'intercity'
    note: deliveryFee === 0 ? 'Машина в вашем городе' : 
          deliveryData.delivery_scope === 'city' ? 'Доставка в городе' :
          deliveryData.delivery_scope === 'airport' ? 'Доставка до аэропорта' :
          'Доставка из другого города'
  },
  return: isOneWay ? {
    amount: returnFee,
    discount: deliveryData.discount_percent,
    note: deliveryData.can_offer_without_fee ? 
          'Бесплатный возврат (машина вернётся в нужный филиал)' :
          deliveryData.discount_percent > 0 ?
          `Скидка ${deliveryData.discount_percent}% на возврат` :
          'Стоимость возврата в филиал выдачи'
  } : null,
  outOfHours: outOfHoursFeeAmount > 0 ? {
    amount: outOfHoursFeeAmount,
    note: 'Доплата за выдачу/приём вне рабочего времени (09:00-20:00)'
  } : null,
  total: totalPrice
};
```

## Полный пример запроса для агента

```sql
-- Поиск машин с полным расчётом стоимости доставки
WITH available_cars AS (
  -- Находим свободные машины
  SELECT DISTINCT
    c.id AS car_id,
    c.plate,
    c.model,
    COALESCE(cbs.future_branch_id, cbs.current_branch_id, c.branch_id) AS effective_branch_id,
    COALESCE(cbs.future_branch_code, cbs.current_branch_code, b.code) AS effective_branch_code,
    cbs.days_until_future_booking,
    cbs.home_branch_id,
    cbs.desired_branch_id
  FROM cars c
  LEFT JOIN branches b ON c.branch_id = b.id
  LEFT JOIN car_branch_states cbs ON c.id = cbs.car_id
  WHERE c.available = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM bookings bk
      WHERE bk.car_id = c.id
        AND bk.status NOT IN ('cancelled', 'rejected', 'deleted')
        AND (
          (bk.start_at <= $1::TIMESTAMPTZ AND bk.end_at >= $1::TIMESTAMPTZ) OR
          (bk.start_at <= $2::TIMESTAMPTZ AND bk.end_at >= $2::TIMESTAMPTZ) OR
          (bk.start_at >= $1::TIMESTAMPTZ AND bk.end_at <= $2::TIMESTAMPTZ)
        )
    )
),
delivery_options AS (
  -- Получаем данные о доставке
  SELECT 
    ac.*,
    cdp.delivery_scope,
    CASE 
      WHEN cdp.delivery_scope = 'city' THEN cdp.in_city_fee_usd
      WHEN cdp.delivery_scope = 'airport' THEN cdp.airport_fee_usd
      ELSE cdp.intercity_fee_usd
    END AS delivery_fee,
    cdp.return_fee_usd,
    cdp.one_way_allowed,
    -- Расчёт скидки
    CASE
      WHEN ac.home_branch_id = (SELECT id FROM branches WHERE code = $3) THEN 100.00
      WHEN ac.desired_branch_id = (SELECT id FROM branches WHERE code = $3) THEN 100.00
      WHEN ac.days_until_future_booking IS NOT NULL 
           AND ac.days_until_future_booking >= 7 
           AND ac.days_until_future_booking <= 14 THEN 50.00
      WHEN ac.days_until_future_booking IS NOT NULL 
           AND ac.days_until_future_booking < 7 THEN 100.00
      ELSE 0.00
    END AS discount_percent
  FROM available_cars ac
  LEFT JOIN city_delivery_pricing cdp ON 
    cdp.delivery_branch_id = ac.effective_branch_id
    AND cdp.city_id = (SELECT id FROM cities WHERE name = $4)
    AND cdp.is_active = TRUE
  WHERE 
    -- Машина в целевом филиале (без доставки)
    ac.effective_branch_id = (SELECT id FROM branches WHERE code = $3)
    OR
    -- Или можно доставить
    cdp.id IS NOT NULL
)
SELECT 
  car_id,
  plate,
  model,
  effective_branch_code,
  delivery_scope,
  delivery_fee,
  return_fee_usd * (1 - discount_percent / 100.0) AS return_fee_with_discount,
  discount_percent,
  days_until_future_booking,
  -- Флаг: бесплатная доставка (машина в целевом филиале)
  CASE WHEN effective_branch_id = (SELECT id FROM branches WHERE code = $3) THEN TRUE ELSE FALSE END AS is_local
FROM delivery_options
ORDER BY 
  -- Сначала локальные машины
  is_local DESC,
  -- Потом по стоимости доставки
  delivery_fee ASC;
```

**Параметры:**
- `$1` — `issueDate` (TIMESTAMPTZ)
- `$2` — `returnDate` (TIMESTAMPTZ)
- `$3` — `targetBranchCode` (TEXT, например 'tbilisi')
- `$4` — `targetCity` (TEXT, например 'Тбилиси')

## Пример использования в коде агента

```javascript
import postgres from 'postgres';

const sql = postgres(CONNECTION_STRING);

async function searchCarsWithDelivery(options) {
  const {
    targetCity,        // "Тбилиси"
    targetBranchCode, // "tbilisi"
    issueDate,        // "2025-02-01 10:00:00+04"
    returnDate,       // "2025-02-05 18:00:00+04"
    isOneWay = false  // односторонняя аренда?
  } = options;
  
  // 1. Находим свободные машины
  const cars = await sql`
    -- Используй запрос из раздела "Полный пример запроса"
    ...
  `;
  
  // 2. Для каждой машины рассчитываем полную стоимость
  const carsWithPricing = await Promise.all(
    cars.map(async (car) => {
      // Доплата за нерабочее время
      const [outOfHours] = await sql`
        SELECT calculate_out_of_hours_fee(
          ${issueDate}::TIMESTAMPTZ,
          ${returnDate}::TIMESTAMPTZ
        ) AS fee
      `;
      
      // Базовая стоимость аренды (из вашей системы)
      const baseRental = await calculateBaseRentalPrice(car.car_id, issueDate, returnDate);
      
      // Стоимость доставки
      const deliveryFee = car.delivery_fee || 0;
      
      // Стоимость возврата (только для односторонней)
      const returnFee = isOneWay ? (car.return_fee_with_discount || 0) : 0;
      
      // Доплата за нерабочее время
      const outOfHoursFee = outOfHours.fee || 0;
      
      // Итоговая стоимость
      const totalPrice = baseRental + deliveryFee + returnFee + outOfHoursFee;
      
      return {
        ...car,
        pricing: {
          baseRental,
          delivery: {
            amount: deliveryFee,
            type: car.delivery_scope,
            isLocal: car.is_local
          },
          return: isOneWay ? {
            amount: returnFee,
            discount: car.discount_percent,
            originalAmount: car.return_fee_usd
          } : null,
          outOfHours: outOfHoursFee > 0 ? {
            amount: outOfHoursFee
          } : null,
          total: totalPrice
        }
      };
    })
  );
  
  // 3. Сортируем по итоговой стоимости
  return carsWithPricing.sort((a, b) => a.pricing.total - b.pricing.total);
}

// Использование
const results = await searchCarsWithDelivery({
  targetCity: "Тбилиси",
  targetBranchCode: "tbilisi",
  issueDate: "2025-02-01 10:00:00+04",
  returnDate: "2025-02-05 18:00:00+04",
  isOneWay: false
});

// Формируем предложение для клиента
results.forEach(car => {
  console.log(`
Машина: ${car.plate} (${car.model})
Филиал: ${car.effective_branch_code}
${car.pricing.delivery.isLocal ? '✅ В вашем городе (без доставки)' : `🚚 Доставка: $${car.pricing.delivery.amount}`}
${car.pricing.return ? `🔄 Возврат: $${car.pricing.return.amount}${car.pricing.return.discount > 0 ? ` (скидка ${car.pricing.return.discount}%)` : ''}` : ''}
${car.pricing.outOfHours ? `⏰ Доплата за нерабочее время: $${car.pricing.outOfHours.amount}` : ''}
💰 Итого: $${car.pricing.total}
  `);
});
```

## Важные замечания

### 1. Использование future_branch_id

**Критично:** При поиске машин для будущих дат всегда используй `future_branch_id`, если он установлен и период аренды пересекает или идёт после следующей брони.

```sql
-- Правильно: учитываем будущий филиал
COALESCE(cbs.future_branch_id, cbs.current_branch_id, c.branch_id) AS search_branch_id

-- Неправильно: используем только текущий филиал
c.branch_id AS search_branch_id
```

### 2. Проверка доступности

Всегда проверяй, что машина свободна в запрашиваемый период:

```sql
WHERE NOT EXISTS (
  SELECT 1 FROM bookings bk
  WHERE bk.car_id = c.id
    AND bk.status NOT IN ('cancelled', 'rejected', 'deleted')
    AND (
      (bk.start_at <= $issueDate AND bk.end_at >= $issueDate) OR
      (bk.start_at <= $returnDate AND bk.end_at >= $returnDate) OR
      (bk.start_at >= $issueDate AND bk.end_at <= $returnDate)
    )
)
```

### 3. Расчёт доплаты за нерабочее время

Всегда используй функцию `calculate_out_of_hours_fee()`, она учитывает таймзону Asia/Tbilisi:

```sql
SELECT calculate_out_of_hours_fee($issueDate, $returnDate);
```

### 4. Скидки применяются автоматически

VIEW `car_delivery_options_view` уже содержит рассчитанные скидки. Просто используй `final_one_way_fee_usd` — там уже учтена скидка.

### 5. Тип доставки

Определяется автоматически на основе:
- Если машина в том же городе → `city` ($10)
- Если есть аэропорт и клиент хочет туда → `airport` ($20)
- Иначе → `intercity` (цена из routes.xlsx)

## Troubleshooting

### Проблема: Не находятся машины из других филиалов

**Решение:** Проверь, что:
1. В таблице `cities` есть запись для целевого города
2. В таблице `city_delivery_pricing` есть маршруты от филиалов до города
3. Используешь правильный `targetBranchCode` (tbilisi, batumi, kutaisi)

### Проблема: Скидки не применяются

**Решение:** Проверь, что:
1. `car_branch_states` обновлена (триггеры работают)
2. `home_branch_id` или `desired_branch_id` установлены
3. `days_until_future_booking` рассчитан корректно

### Проблема: Доплата за нерабочее время не считается

**Решение:** Убедись, что:
1. Время передаётся в формате TIMESTAMPTZ
2. Используешь функцию `calculate_out_of_hours_fee()`
3. Таймзона учтена (Asia/Tbilisi)

## Дополнительные ресурсы

- Полная документация системы: [docs/DELIVERY_SYSTEM.md](./DELIVERY_SYSTEM.md)
- Структура БД: [STRUCTURE.md](../STRUCTURE.md)
- Примеры SQL запросов: см. раздел "Полный пример запроса" выше

