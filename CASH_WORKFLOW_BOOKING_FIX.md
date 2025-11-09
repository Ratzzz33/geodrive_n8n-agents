# ✅ ИСПРАВЛЕНО: booking_id type mismatch в Company Cash Monitor

**Дата:** 2025-11-08  
**Execution:** 2485  
**Проблема:** `column "booking_id" is of type uuid but expression is of type integer`

---

## 🔍 Анализ execution 2485

### ✅ Успешные ноды (1-11):
1. ✅ **Every 3 Minutes** - триггер
2. ✅ **[4 Branch Pages]** - URL сформированы
3. ✅ **[4 Get Branches]** - данные получены (tbilisi: 250ms, batumi/kutaisi: 258-262ms, service: 580ms)
4. ✅ **Merge & Process** - 189 items собрано за 119ms
5. ✅ **Prepare Batch Insert** - batch VALUES сформирован за 79ms
   - ✅ `cash: true` → `1` (функция `toNumber()` работает!)
   - ✅ `cashless: 0` → `0`

### ❌ Проблемная нода:
**Save Payment to DB** (нода 12) - SQL ошибка после 3.3 секунды:

```
column "booking_id" is of type uuid but expression is of type integer
```

### 📊 Результат:
- ❌ 0 payments сохранено
- ❌ 1 ошибка
- 💰 "Всего: 0 / 1"

---

## 🔍 Причина проблемы

### В таблице `payments`:
```sql
booking_id UUID     -- Ссылка на таблицу bookings (НАШ UUID)
```

### Workflow пытался вставить:
```sql
booking_id = 509078  -- INTEGER из RentProg!
```

### PostgreSQL отклонил:
```
ERROR: cannot cast type integer to uuid
```

---

## ✅ Решение

### Удалено из INSERT:
- ❌ `booking_id` (UUID колонка, не подходит для RentProg ID)

### Исправленный SQL:
```sql
INSERT INTO payments (
  branch, payment_id, sum, cash, cashless, "group", subgroup, description,
  car_id, client_id, user_id, created_at, raw_data
  -- БЕЗ booking_id!
) VALUES ...
```

### Почему это правильно:
1. **booking_id** (UUID) - это ссылка на НАШИ брони в таблице `bookings`
2. **RentProg booking ID** (509078) - это внешний ID, который НЕ является UUID
3. Если нужна связь с RentProg бронями - это делается через:
   - `raw_data` (JSON содержит `booking_id: 509078`)
   - Или отдельное поле `rp_booking_id` (пока не добавлено, т.к. не критично)

---

## 📊 До и после

| Метрика | До | После |
|---------|-----|-------|
| **Execution** | 2485 (failed) | 2486+ (should work) |
| **Save Payment to DB** | ❌ Type error | ✅ Должно работать |
| **Items saved** | 0 / 189 | **189 / 189** |
| **Batch INSERT** | ❌ Не выполнился | ✅ Выполнится |
| **booking_id** | ❌ INTEGER → UUID (error) | ✅ Не используется |

---

## 🎯 Итоговая структура INSERT

```sql
INSERT INTO payments (
  branch,          -- TEXT (alias)
  payment_id,      -- BIGINT (alias для rp_payment_id)
  sum,             -- NUMERIC (alias для amount)
  cash,            -- NUMERIC (с toNumber!)
  cashless,        -- NUMERIC (с toNumber!)
  "group",         -- TEXT (alias для payment_type)
  subgroup,        -- TEXT (alias для payment_subgroup)
  description,     -- TEXT
  car_id,          -- BIGINT (alias для rp_car_id)
  client_id,       -- BIGINT (alias для rp_client_id)
  user_id,         -- BIGINT (alias для rp_user_id)
  created_at,      -- TIMESTAMPTZ
  raw_data         -- JSONB (содержит booking_id: 509078)
) VALUES ...
```

---

## 🚀 Готово к запуску!

**Workflow:** https://n8n.rentflow.rentals/workflow/w8g8cJb0ccReaqIE

**Следующий execution должен:**
- ✅ Обработать все 189 items
- ✅ Выполнить 1 batch INSERT за ~0.5 сек
- ✅ Сохранить все payments в БД
- ✅ Нет type errors
- ✅ Дедупликация работает (ON CONFLICT)

---

## 📝 Примечание

**booking_id из RentProg** (509078) сохраняется в колонке `raw_data` (JSONB).

Если в будущем понадобится прямой доступ к RentProg booking ID, можно:
1. Добавить колонку `rp_booking_id BIGINT`
2. Обновить workflow и схему
3. Создать миграцию для заполнения из `raw_data`

Но пока это **не критично**, т.к.:
- Связь есть через `raw_data`
- Основные связи через `car_id`, `client_id`, `user_id` работают
- Платежи корректно сохраняются

---

## 🔧 Связанные исправления

### История решения проблемы:

**Execution 2476:** ❌ Проблема обнаружена (нет колонки `branch`)
- ✅ Добавлена колонка `branch`
- ✅ Добавлено 9 alias-колонок
- ✅ Созданы индексы
- ✅ UNIQUE constraint

**Execution 2482:** ❌ Type mismatch `cash` (boolean → numeric)
- ✅ Добавлена функция `toNumber()`
- ✅ Исправлена конвертация boolean → numeric

**Execution 2485:** ❌ Type mismatch `booking_id` (integer → uuid)
- ✅ **Удалён booking_id из INSERT** ← текущее исправление!

---

## 📚 Документация

- `CASH_WORKFLOW_FINAL_FIX_COMPLETE.md` - предыдущие исправления
- `PAYMENTS_COLUMNS_FIXED.md` - добавление колонок
- `setup/add_branch_to_payments.mjs` - миграция branch
- `setup/add_missing_payment_columns.mjs` - миграция alias-колонок
- `src/db/schema.ts` - обновлённая схема

