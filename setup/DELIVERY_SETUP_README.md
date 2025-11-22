# Инструкция по установке системы доставки авто

## Быстрый старт

### 1. Применить миграции БД

```bash
node setup/run_delivery_migrations.mjs
```

Это создаст все необходимые таблицы, функции, триггеры и представления.

### 2. Импортировать данные из Excel

```bash
node setup/import_cities_and_routes.mjs
```

**Требования:**
- Файлы `excel/cities.xlsx` и `excel/routes.xlsx` должны существовать
- В таблице `branches` должны быть записи для всех филиалов

### 3. Проверить результат

```sql
-- Проверить количество городов
SELECT COUNT(*) FROM cities;

-- Проверить количество тарифов
SELECT COUNT(*) FROM city_delivery_pricing;

-- Проверить правила скидок
SELECT * FROM one_way_discount_rules ORDER BY priority;

-- Проверить VIEW
SELECT COUNT(*) FROM car_delivery_options_view;
```

## Структура миграций

1. **0032_create_cities_table.sql** - Таблица городов
2. **0033_create_city_delivery_pricing.sql** - Тарифы доставки
3. **0034_create_car_branch_states.sql** - Статусы филиалов машин
4. **0035_create_one_way_discount_rules.sql** - Правила скидок
5. **0036_create_future_branch_functions.sql** - Функции для расчёта future_branch
6. **0037_create_future_branch_triggers.sql** - Триггеры на bookings
7. **0038_create_car_delivery_options_view.sql** - VIEW для агента
8. **0039_create_out_of_hours_function.sql** - Функции для нерабочего времени

## Формат Excel файлов

### cities.xlsx

Ожидаемые колонки:
- `name` или `city` или `Название` - название города
- `primary_branch` или `branch` или `Филиал` - код филиала (tbilisi, batumi, kutaisi, service-center)
- `nearest_branch` или `Ближайший филиал` - ближайший филиал (опционально)
- `has_airport` или `Есть аэропорт` - есть ли аэропорт (true/false)
- `airport_name` или `Название аэропорта` - название аэропорта (опционально)

### routes.xlsx

Ожидаемые колонки:
- `city` или `Город` - название города
- `from_branch` или `От филиала` или `from` - код филиала отправления
- `to_branch` или `До филиала` или `to` - код филиала назначения
- `price_usd` или `Цена USD` или `price` - стоимость доставки в USD
- `eta_hours` или `Время в часах` или `eta` - время доставки в часах (опционально)

## Что происходит автоматически

После установки система автоматически:

1. **Обновляет future_branch_id** при любых изменениях в таблице `bookings`:
   - Создание новой брони
   - Обновление существующей брони
   - Отмена/удаление брони

2. **Обновляет desired_branch_id** по правилам:
   - Если до будущей брони ≤7 дней → `desired = future`
   - Если есть `home_branch` → `desired = home`

3. **Рассчитывает скидки** на одностороннюю аренду:
   - 100% для home/desired филиалов
   - 50% для 7-14 дней до брони
   - 100% для <7 дней до брони

## Использование в коде

### Пример запроса для агента

```javascript
import postgres from 'postgres';

const sql = postgres(CONNECTION_STRING);

// Найти машины, которые можно доставить в Tbilisi
const cars = await sql`
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
    AND delivery_scope = 'intercity'
  ORDER BY final_delivery_fee_usd ASC
`;
```

### Расчёт доплаты за нерабочее время

```javascript
// Рассчитать доплату за нерабочее время
const outOfHoursFee = await sql`
  SELECT calculate_out_of_hours_fee(
    ${issueTime},  -- время выдачи
    ${returnTime}  -- время возврата
  ) AS fee
`;

// Результат: 0, 20 или 40 (в зависимости от времени)
```

## Troubleshooting

### Ошибка при применении миграций

Если миграция падает с ошибкой, проверьте:
1. Подключение к БД работает
2. Все предыдущие миграции применены
3. Нет конфликтов с существующими таблицами

### Данные не импортируются из Excel

1. Проверьте формат файлов (.xlsx)
2. Проверьте названия колонок
3. Убедитесь, что филиалы созданы в `branches`
4. Проверьте логи импорта

### Триггеры не срабатывают

1. Проверьте, что триггеры созданы:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname LIKE '%future_branch%';
   ```

2. Проверьте, что функции существуют:
   ```sql
   SELECT * FROM pg_proc WHERE proname LIKE '%future_branch%';
   ```

3. Запустите обновление вручную:
   ```sql
   SELECT refresh_car_branch_state('car_id');
   ```

## Дополнительная документация

Полная документация: [docs/DELIVERY_SYSTEM.md](../docs/DELIVERY_SYSTEM.md)

