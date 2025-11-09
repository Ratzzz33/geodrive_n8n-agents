# ✅ Booking.responsible_id — ЗАВЕРШЕНО УСПЕШНО

**Дата:** 2025-11-08  
**Статус:** ✅ Полностью реализовано и протестировано

---

## 🎯 Задача

Реализовать поддержку поля `responsible_id` в таблице `bookings`, которое ссылается на ответственного сотрудника из RentProg вебхуков.

### Особенности RentProg вебхуков

При изменении ответственного сотрудника RentProg присылает:
```json
{
  "responsible_id": [15748, 16003],
  "responsible": [null, "Данияр Байбаков"]
}
```

Где:
- `[0]` - старое значение (может быть `null`)
- `[1]` - новое значение

---

## 📝 Реализация

### 1. Схема БД

#### Таблица `rentprog_employees`

```sql
CREATE TABLE rentprog_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rentprog_id TEXT UNIQUE NOT NULL,
  name TEXT,
  first_name TEXT,
  last_name TEXT,
  company_id INTEGER,
  employee_id UUID REFERENCES employees(id), -- Опциональная связь с Jarvis
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rentprog_employees_rentprog_id ON rentprog_employees(rentprog_id);
CREATE INDEX idx_rentprog_employees_company_id ON rentprog_employees(company_id);
```

#### Изменения в `bookings`

```sql
ALTER TABLE bookings 
  ADD COLUMN responsible_id UUID REFERENCES rentprog_employees(id);

CREATE INDEX idx_bookings_responsible ON bookings(responsible_id);
```

#### TypeScript Schema

```typescript
export const rentprogEmployees = pgTable('rentprog_employees', {
  id: uuid('id').defaultRandom().primaryKey(),
  rentprog_id: text('rentprog_id').unique().notNull(),
  name: text('name'),
  first_name: text('first_name'),
  last_name: text('last_name'),
  company_id: integer('company_id'),
  employee_id: uuid('employee_id').references(() => employees.id),
  data: jsonb('data').default(sql`'{}'::jsonb`),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const bookings = pgTable('bookings', {
  // ... другие поля
  responsible_id: uuid('responsible_id').references(() => rentprogEmployees.id),
  // ...
});
```

---

### 2. Триггер `process_booking_nested_entities()`

Объединённый триггер, который:
1. Обрабатывает `car` и `client` из `NEW.data`
2. Извлекает сотрудников (`responsible_id`, `manager_id`)
3. Создаёт новых или обновляет существующих сотрудников
4. Устанавливает `bookings.responsible_id`
5. Очищает `NEW.data`

**Файл:** `setup/merge_triggers_proper.mjs`

**Ключевые особенности:**
- ✅ Поддержка массивов `[old, new]` и одиночных значений
- ✅ Upsert сотрудников через `external_refs`
- ✅ Обновление имени если изменилось
- ✅ Fallback имя `"Employee {id}"` если `name = null`
- ✅ Запуск BEFORE INSERT/UPDATE

---

### 3. Интеграция с `dynamic_upsert_entity`

**Важно:** При вызове `dynamic_upsert_entity` передавать данные через `sql.json()`:

```javascript
// ✅ ПРАВИЛЬНО
await sql`
  SELECT * FROM dynamic_upsert_entity(
    'bookings'::TEXT,
    '506974'::TEXT,
    ${sql.json(bookingData)}
  )
`

// ❌ НЕПРАВИЛЬНО (double-encoding!)
await sql`
  SELECT * FROM dynamic_upsert_entity(
    'bookings'::TEXT,
    '506974'::TEXT,
    ${JSON.stringify(bookingData)}::JSONB
  )
`
```

---

## ✅ Тесты

### Тест 1: Одиночное значение

```javascript
const bookingData = {
  id: 555555,
  responsible_id: '55555',
  responsible: 'Иван Иванов',
  state: 'planned',
  price: 1000
};
```

**Результат:**
- ✅ Сотрудник создан: `55555 → "Иван Иванов"`
- ✅ `bookings.responsible_id` заполнен UUID сотрудника

### Тест 2: Массив [old, new]

```javascript
const bookingData = {
  id: 555555,
  responsible_id: ['55555', '66666'],
  responsible: ['Иван Иванов', 'Петр Петров'],
  state: 'active',
  price: 1500
};
```

**Результат:**
- ✅ Оба сотрудника созданы:
  - `55555 → "Иван Иванов"`
  - `66666 → "Петр Петров"`
- ✅ `bookings.responsible_id` указывает на **НОВОГО** сотрудника (`66666`)
- ✅ При повторном запуске: имя старого сотрудника обновлено (если изменилось)

### Тест 3: Массив с null именем

```javascript
const bookingData = {
  id: 506974,
  responsible_id: ['15748', '16003'],
  responsible: [null, 'Данияр Байбаков']
};
```

**Результат:**
- ✅ Старый сотрудник: `15748 → "Employee 15748"` (fallback)
- ✅ Новый сотрудник: `16003 → "Данияр Байбаков"`
- ✅ `bookings.responsible_id` указывает на `16003`

---

## 📊 Проверка

### Проверка реального booking

```bash
node setup/check_real_booking_506974.mjs
```

**Результат:**
```
✅ Ответственный: Данияр Байбаков (RentProg ID: 16003)
✅ Оба сотрудника созданы
```

### Финальный тест всей системы

```bash
node setup/final_complete_test.mjs
```

**Результат:**
```
🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!

✅ Оба сотрудника созданы
✅ bookings.responsible_id заполнен
✅ responsible_id указывает на НОВОГО сотрудника (66666)
✅ data очищен (триггер сработал)
```

---

## 🚀 Миграции

### 1. Добавление `responsible_id` в `bookings`

```bash
node setup/fix_bookings_responsible_fk.mjs
```

### 2. Объединение триггеров

```bash
node setup/merge_triggers_proper.mjs
```

### 3. Обновление триггера для `INSERT OR UPDATE`

```bash
node setup/recreate_trigger_with_update.mjs
```

---

## 📂 Файлы

- ✅ `src/db/schema.ts` - Обновлена схема
- ✅ `setup/fix_bookings_responsible_fk.mjs` - Миграция
- ✅ `setup/merge_triggers_proper.mjs` - Объединённый триггер
- ✅ `setup/final_complete_test.mjs` - Финальный тест
- ✅ `setup/fix_duplicate_employee_16003.mjs` - Исправление дубликатов

---

## ⚠️ Важные замечания

### 1. External Refs Pattern

Все employee создаются через `external_refs`:
```sql
SELECT entity_id INTO employee_uuid
FROM external_refs
WHERE system = 'rentprog'
  AND external_id = '16003'
  AND entity_type = 'rentprog_employee';
```

### 2. Upsert логика

- Если сотрудник существует → обновляем имя (если изменилось)
- Если не существует → создаём нового + запись в `external_refs`

### 3. Порядок триггеров

**ВАЖНО:** Триггер `process_booking_nested_entities` должен:
1. Извлечь данные из `NEW.data` ПЕРЕД очисткой
2. Установить `NEW.responsible_id`
3. Очистить `NEW.data := '{}'::jsonb`
4. Вернуть `RETURN NEW`

### 4. Передача JSONB

При вызове PostgreSQL функций из JavaScript:
```javascript
// ✅ sql.json(data) - правильно
// ❌ JSON.stringify(data)::JSONB - double-encoding!
```

---

## 🎉 Итог

- ✅ Поле `bookings.responsible_id` реализовано
- ✅ Таблица `rentprog_employees` создана
- ✅ Триггер обрабатывает массивы `[old, new]` и одиночные значения
- ✅ Поддержка `null` имён (fallback)
- ✅ Upsert сотрудников через `external_refs`
- ✅ Все тесты пройдены успешно
- ✅ Реальный booking 506974 исправлен

**Система готова к production!** 🚀

