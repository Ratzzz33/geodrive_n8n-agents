# Система доставки авто между филиалами

## Описание

Система позволяет агенту подбора свободных авто предлагать машины из других филиалов с автоматическим расчётом стоимости доставки и возврата, учитывая:
- Тарифы доставки (внутри города: $10, до аэропорта: $20, между городами: из `routes.xlsx`)
- Скидки на одностороннюю аренду (100% при возврате в родной/желаемый филиал, 50-100% в зависимости от времени до следующей брони)
- Доплату за нерабочее время ($20 за выдачу/приём вне 09:00-20:00)

## Структура БД

### Таблицы

1. **cities** - Города с привязкой к филиалам
   - `primary_branch_id` - основной филиал города
   - `nearest_branch_id` - ближайший филиал (если город не имеет своего)
   - `has_airport` - есть ли аэропорт

2. **city_delivery_pricing** - Тарифы доставки
   - `delivery_scope` - тип доставки: `city` ($10), `airport` ($20), `intercity` (из routes.xlsx)
   - `intercity_fee_usd` - стоимость между городами
   - `return_fee_usd` - стоимость возврата (обычно = intercity_fee_usd)

3. **car_branch_states** - Статусы филиалов для машин
   - `current_branch_id` - где машина сейчас
   - `future_branch_id` - куда должна вернуться по ближайшей брони
   - `desired_branch_id` - куда хотим перегнать (автоматически или вручную)
   - `home_branch_id` - родной филиал машины
   - `days_until_future_booking` - дней до следующей брони

4. **one_way_discount_rules** - Правила скидок
   - Стандартные правила: 100% для home/desired, 50% для 7-14 дней, 100% для <7 дней

### Функции

- `get_branch_by_city(city_name)` - определение филиала по городу
- `update_car_future_branch(car_id)` - обновление future_branch_id
- `update_car_desired_branch(car_id)` - автоматическое обновление desired_branch_id
- `refresh_car_branch_state(car_id)` - полное обновление состояния машины
- `is_out_of_hours(time)` - проверка нерабочего времени
- `calculate_out_of_hours_fee(issue_time, return_time)` - расчёт доплаты за нерабочее время

### Триггеры

- `bookings_insert_update_future_branch` - при создании брони
- `bookings_update_update_future_branch` - при обновлении брони
- `bookings_delete_update_future_branch` - при удалении/отмене брони

### Представления

- `car_delivery_options_view` - готовые данные для агента с расчётом стоимости доставки и скидок

## Установка

### 1. Применить миграции

```bash
node setup/run_delivery_migrations.mjs
```

### 2. Импортировать данные из Excel

```bash
node setup/import_cities_and_routes.mjs
```

**Важно:** Перед импортом убедитесь, что:
- Файлы `excel/cities.xlsx` и `excel/routes.xlsx` существуют
- В таблице `branches` есть записи для всех филиалов (tbilisi, batumi, kutaisi, service-center)

## Использование

### Для агента подбора авто

Агент может использовать VIEW `car_delivery_options_view` для получения готовых данных:

```sql
SELECT 
  car_id,
  car_plate,
  current_branch_code,
  future_branch_code,
  target_branch_code,
  delivery_scope,
  final_delivery_fee_usd,
  final_one_way_fee_usd,
  discount_percent,
  can_offer_without_fee
FROM car_delivery_options_view
WHERE target_branch_code = 'tbilisi'
  AND car_id = '...'
```

### Расчёт доплаты за нерабочее время

```sql
SELECT calculate_out_of_hours_fee(
  '2025-01-15 08:00:00+04'::TIMESTAMPTZ, -- выдача в 8:00 (нерабочее время)
  '2025-01-20 21:00:00+04'::TIMESTAMPTZ  -- возврат в 21:00 (нерабочее время)
);
-- Результат: 40.00 (20$ за выдачу + 20$ за возврат)
```

### Ручное обновление желаемого филиала

```sql
UPDATE car_branch_states
SET 
  desired_branch_id = (SELECT id FROM branches WHERE code = 'tbilisi'),
  desired_branch_code = 'tbilisi',
  desired_reason = 'manual',
  desired_set_at = NOW()
WHERE car_id = '...';
```

### Установка родного филиала для машины

```sql
UPDATE car_branch_states
SET 
  home_branch_id = (SELECT id FROM branches WHERE code = 'batumi'),
  home_branch_code = 'batumi'
WHERE car_id = '...';
```

## Автоматическое обновление

Система автоматически обновляет `future_branch_id` и `desired_branch_id` при:
- Создании новой брони
- Обновлении существующей брони (изменение дат, статуса, машины)
- Отмене/удалении брони

**Правила автоматического обновления desired_branch:**
- Если до будущей брони ≤7 дней → `desired_branch = future_branch`
- Если есть `home_branch` → `desired_branch = home_branch`

## Правила скидок на одностороннюю аренду

1. **100% скидка** (бесплатно):
   - Возврат в `home_branch`
   - Возврат в `desired_branch`
   - До следующей брони <7 дней

2. **50% скидка**:
   - До следующей брони 7-14 дней

3. **0% скидка** (полная стоимость):
   - Все остальные случаи

## Тарифы доставки

- **Внутри города**: $10
- **До аэропорта**: $20
- **Между городами**: из файла `routes.xlsx` (одинаковая цена для офиса/аэропорта/любой точки города)

## Доплата за нерабочее время

- **Размер**: $20 за каждую операцию (выдача или возврат)
- **Рабочее время**: 09:00 - 20:00 (Asia/Tbilisi)
- **Нерабочее время**: до 09:00 или после 20:00

Примеры:
- Выдача в 08:00 → +$20
- Возврат в 21:00 → +$20
- Выдача в 08:00 и возврат в 21:00 → +$40

## Примеры использования в коде

### Поиск машин с расчётом доставки

```javascript
// Найти машины, которые можно доставить в Tbilisi
const cars = await sql`
  SELECT 
    car_id,
    car_plate,
    current_branch_code,
    final_delivery_fee_usd,
    final_one_way_fee_usd,
    discount_percent
  FROM car_delivery_options_view
  WHERE target_branch_code = 'tbilisi'
    AND delivery_scope = 'intercity'
  ORDER BY final_delivery_fee_usd ASC
`;
```

### Расчёт полной стоимости для клиента

```javascript
// Получить данные о доставке
const delivery = await sql`
  SELECT 
    final_delivery_fee_usd,
    final_one_way_fee_usd,
    out_of_hours_fee_usd
  FROM car_delivery_options_view
  WHERE car_id = ${carId}
    AND target_branch_code = ${targetBranch}
`;

// Рассчитать доплату за нерабочее время
const outOfHoursFee = await sql`
  SELECT calculate_out_of_hours_fee(
    ${issueTime},
    ${returnTime}
  )
`;

// Итоговая стоимость
const totalDeliveryFee = 
  delivery.final_delivery_fee_usd +
  (isOneWay ? delivery.final_one_way_fee_usd : 0) +
  outOfHoursFee;
```

## Troubleshooting

### Проблема: future_branch_id не обновляется

**Решение:**
1. Проверьте, что триггеры созданы: `\df trigger_update_car_future_branch`
2. Проверьте, что в бронях есть `car_id` и корректные даты
3. Запустите вручную: `SELECT refresh_car_branch_state('car_id')`

### Проблема: desired_branch_id не устанавливается автоматически

**Решение:**
1. Проверьте, что `future_branch_id` обновлён
2. Проверьте, что `days_until_future_booking` рассчитан
3. Запустите вручную: `SELECT update_car_desired_branch('car_id')`

### Проблема: данные из Excel не импортируются

**Решение:**
1. Проверьте формат Excel файлов (должны быть .xlsx)
2. Проверьте названия колонок в файлах
3. Убедитесь, что филиалы созданы в таблице `branches`
4. Проверьте логи импорта на наличие ошибок

