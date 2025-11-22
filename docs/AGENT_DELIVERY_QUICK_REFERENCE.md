# Быстрая справка для агента поиска авто с доставкой

## 🎯 Основные шаги

1. **Определить целевой филиал/город** клиента
2. **Найти свободные машины** (используй `future_branch_id` для будущих дат)
3. **Получить данные о доставке** из VIEW `car_delivery_options_view`
4. **Рассчитать доплату за нерабочее время** через функцию `calculate_out_of_hours_fee()`
5. **Сложить всё вместе**: базовая аренда + доставка + возврат + нерабочее время

## 📊 Ключевые SQL запросы

### Поиск машин с доставкой

```sql
-- Используй ПРИМЕР 1 из AGENT_DELIVERY_SEARCH_EXAMPLES.sql
-- Параметры: issueDate, returnDate, targetBranchCode, targetCity
```

### Получить стоимость доставки

```sql
SELECT 
  final_delivery_fee_usd,
  final_one_way_fee_usd,
  discount_percent,
  can_offer_without_fee
FROM car_delivery_options_view
WHERE car_id = $1 AND target_branch_code = $2;
```

### Рассчитать доплату за нерабочее время

```sql
SELECT calculate_out_of_hours_fee($issueTime, $returnTime) AS fee;
-- Результат: 0, 20 или 40
```

## 💰 Формула итоговой стоимости

```
totalPrice = baseRental 
           + deliveryFee 
           + (isOneWay ? returnFee : 0) 
           + outOfHoursFee
```

Где:
- `baseRental` — базовая стоимость аренды (из вашей системы)
- `deliveryFee` — из `final_delivery_fee_usd` (VIEW)
- `returnFee` — из `final_one_way_fee_usd` (VIEW, уже со скидкой)
- `outOfHoursFee` — из функции `calculate_out_of_hours_fee()`

## ⚠️ Важные правила

### 1. Использование future_branch_id

**ВСЕГДА** используй `future_branch_id` для поиска, если период аренды идёт после следующей брони:

```sql
COALESCE(cbs.future_branch_id, cbs.current_branch_id, c.branch_id) AS search_branch_id
```

### 2. Проверка доступности

Всегда проверяй отсутствие пересекающихся броней:

```sql
WHERE NOT EXISTS (
  SELECT 1 FROM bookings bk
  WHERE bk.car_id = c.id
    AND bk.status NOT IN ('cancelled', 'rejected', 'deleted')
    AND (пересечение дат)
)
```

### 3. Скидки применяются автоматически

VIEW `car_delivery_options_view` уже содержит рассчитанные скидки в поле `final_one_way_fee_usd`. Просто используй это значение.

### 4. Типы доставки

- `city` — внутри города ($10)
- `airport` — до аэропорта ($20)
- `intercity` — между городами (цена из routes.xlsx)

## 📝 Пример кода

```javascript
// 1. Поиск машин
const cars = await sql`...`; // Используй ПРИМЕР 1

// 2. Для каждой машины
for (const car of cars) {
  // Доплата за нерабочее время
  const [outOfHours] = await sql`
    SELECT calculate_out_of_hours_fee(${issueDate}, ${returnDate}) AS fee
  `;
  
  // Итоговая стоимость
  const total = baseRental 
              + car.delivery_fee_usd 
              + (isOneWay ? car.return_fee_usd : 0)
              + outOfHours.fee;
}
```

## 🔍 Troubleshooting

| Проблема | Решение |
|----------|---------|
| Не находятся машины | Проверь `cities` и `city_delivery_pricing` |
| Скидки не применяются | Проверь `car_branch_states` (триггеры работают?) |
| Доплата не считается | Используй функцию `calculate_out_of_hours_fee()` |

## 📚 Полная документация

- **Подробная инструкция**: [AGENT_DELIVERY_SEARCH_GUIDE.md](./AGENT_DELIVERY_SEARCH_GUIDE.md)
- **Примеры SQL**: [AGENT_DELIVERY_SEARCH_EXAMPLES.sql](./AGENT_DELIVERY_SEARCH_EXAMPLES.sql)
- **Система доставки**: [DELIVERY_SYSTEM.md](./DELIVERY_SYSTEM.md)

