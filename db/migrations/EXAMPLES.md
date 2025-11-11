# 📝 ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ

Практические примеры работы с нормализованными данными броней.

---

## 🎯 Для разработчиков

### JavaScript/TypeScript

#### Создание брони (рекомендуемый способ)

```typescript
import { db } from './db';
import { bookings } from './db/schema';

// ✅ ПРАВИЛЬНО: Заполняем оба формата
const newBooking = await db.insert(bookings).values({
  car_id: carUuid,
  client_id: clientUuid,
  
  // Даты в ОБОИХ форматах
  start_date: '2025-11-10 16:00:00+04',
  end_date: '2025-11-15 14:30:00+04',
  start_at: new Date('2025-11-10T16:00:00+04:00'),
  end_at: new Date('2025-11-15T14:30:00+04:00'),
  
  // Статусы в ОБОИХ форматах
  state: 'Активная',
  status: 'active'
}).returning();

console.log('Создана бронь:', newBooking);
```

#### Создание брони (минимальный вариант)

```typescript
// ✅ РАБОТАЕТ: Триггер автоматически заполнит остальное
const newBooking = await db.insert(bookings).values({
  car_id: carUuid,
  start_at: new Date('2025-11-10T16:00:00+04:00'),
  end_at: new Date('2025-11-15T14:30:00+04:00'),
  status: 'active'
}).returning();

// Триггер автоматически добавит:
// - start_date = '2025-11-10 16:00:00+04'
// - end_date = '2025-11-15 14:30:00+04'
// - state = 'Активная'
```

#### Конвертация дат из RentProg

```typescript
/**
 * Конвертирует дату из формата RentProg в нормализованный формат
 */
function normalizeRentProgDate(dateStr: string): string {
  // Формат 1: "10-11-2025 12:00"
  if (dateStr.match(/^\d{2}-\d{2}-\d{4}/)) {
    const [date, time] = dateStr.split(' ');
    const [day, month, year] = date.split('-');
    return `${year}-${month}-${day} ${time || '12:00:00'}+04`;
  }
  
  // Формат 2: "2025-11-10T13:30:00.000+03:00"
  if (dateStr.includes('T')) {
    const date = new Date(dateStr);
    const offset = dateStr.match(/([+-]\d{2}):?\d{2}$/)?.[1] || '+04';
    const formatted = date.toISOString()
      .replace('T', ' ')
      .replace(/\.\d{3}Z$/, offset);
    return formatted;
  }
  
  return dateStr;
}

// Использование
const rentprogDate = "10-11-2025 12:00";
const normalized = normalizeRentProgDate(rentprogDate);
console.log(normalized); // "2025-11-10 12:00:00+04"
```

#### Конвертация статусов

```typescript
/**
 * Маппинг статусов: русский ↔ английский
 */
const statusMap = {
  // Русский -> Английский
  'Активная': 'active',
  'Новая': 'active',
  'Подтверждена': 'confirmed',
  'Отъездила': 'completed',
  'Отмена': 'cancelled',
  'Отказ клиента': 'cancelled',
  'Недозвон': 'pending',
  'Не подтверждена': 'pending',
  
  // Английский -> Русский (обратный маппинг)
  'active': 'Активная',
  'confirmed': 'Подтверждена',
  'in_rent': 'Активная',
  'completed': 'Отъездила',
  'cancelled': 'Отмена',
  'pending': 'Новая'
} as const;

function normalizeStatus(input: string): { state: string; status: string } {
  const isRussian = /[А-Яа-я]/.test(input);
  
  if (isRussian) {
    return {
      state: input,
      status: statusMap[input as keyof typeof statusMap] || 'active'
    };
  } else {
    return {
      state: statusMap[input as keyof typeof statusMap] || 'Новая',
      status: input
    };
  }
}

// Использование
const { state, status } = normalizeStatus('Активная');
console.log(state, status); // "Активная" "active"
```

#### Импорт из RentProg (полный пример)

```typescript
import { db } from './db';
import { bookings, cars, clients, externalRefs } from './db/schema';

async function importBookingFromRentProg(rentprogData: any, branch: string) {
  // 1. Нормализуем даты
  const startDate = normalizeRentProgDate(rentprogData.start_date);
  const endDate = normalizeRentProgDate(rentprogData.end_date);
  
  // 2. Нормализуем статус
  const { state, status } = normalizeStatus(rentprogData.state || rentprogData.status);
  
  // 3. Получаем UUID машины и клиента через external_refs
  const carRef = await db.select()
    .from(externalRefs)
    .where(eq(externalRefs.system, 'rentprog'))
    .where(eq(externalRefs.external_id, rentprogData.car_id.toString()))
    .limit(1);
  
  const clientRef = await db.select()
    .from(externalRefs)
    .where(eq(externalRefs.system, 'rentprog'))
    .where(eq(externalRefs.external_id, rentprogData.client_id.toString()))
    .limit(1);
  
  if (!carRef[0] || !clientRef[0]) {
    throw new Error('Car or Client not found');
  }
  
  // 4. Создаем/обновляем бронь
  const booking = await db.insert(bookings).values({
    car_id: carRef[0].entity_id,
    client_id: clientRef[0].entity_id,
    
    // Даты в обоих форматах
    start_date: startDate,
    end_date: endDate,
    start_at: new Date(startDate),
    end_at: new Date(endDate),
    
    // Статусы в обоих форматах
    state,
    status,
    
    // Дополнительные данные
    data: rentprogData
  }).onConflictDoUpdate({
    target: bookings.id,
    set: {
      start_date: startDate,
      end_date: endDate,
      start_at: new Date(startDate),
      end_at: new Date(endDate),
      state,
      status,
      data: rentprogData,
      updated_at: new Date()
    }
  }).returning();
  
  // 5. Сохраняем external_ref для брони
  await db.insert(externalRefs).values({
    entity_type: 'booking',
    entity_id: booking[0].id,
    system: 'rentprog',
    external_id: rentprogData.id.toString(),
    branch_code: branch,
    meta: { raw: rentprogData }
  }).onConflictDoNothing();
  
  return booking[0];
}
```

---

## 🔍 Поиск свободных автомобилей

### SQL запрос

```sql
-- Найти машины свободные в указанный период
WITH active_bookings AS (
  SELECT DISTINCT car_id
  FROM bookings
  WHERE (
    -- Проверка по обоим форматам даты
    (start_at, end_at) OVERLAPS (
      '2025-11-10 16:00:00+04'::timestamptz,
      '2025-11-15 14:30:00+04'::timestamptz
    )
    OR
    (start_date::timestamptz, end_date::timestamptz) OVERLAPS (
      '2025-11-10 16:00:00+04'::timestamptz,
      '2025-11-15 14:30:00+04'::timestamptz
    )
  )
  AND (
    -- Проверка по обоим статусам
    state IN ('Активная', 'Новая', 'Подтверждена')
    OR status IN ('active', 'confirmed', 'in_rent', 'Активная', 'Новая', 'Подтверждена')
  )
)
SELECT c.*
FROM cars c
WHERE c.id NOT IN (SELECT car_id FROM active_bookings)
  AND c.branch_code = 'tbilisi'
ORDER BY c.plate;
```

### TypeScript (Drizzle ORM)

```typescript
import { db } from './db';
import { cars, bookings } from './db/schema';
import { sql, notInArray, eq, or, and } from 'drizzle-orm';

async function findAvailableCars(
  startDate: Date,
  endDate: Date,
  branchCode: string
) {
  // Подзапрос: активные брони в указанный период
  const activeBookings = db
    .select({ carId: bookings.car_id })
    .from(bookings)
    .where(
      and(
        // Проверка пересечения дат (через OVERLAPS)
        or(
          sql`(${bookings.start_at}, ${bookings.end_at}) OVERLAPS (${startDate}::timestamptz, ${endDate}::timestamptz)`,
          sql`(${bookings.start_date}::timestamptz, ${bookings.end_date}::timestamptz) OVERLAPS (${startDate}::timestamptz, ${endDate}::timestamptz)`
        ),
        // Проверка статуса (русский или английский)
        or(
          sql`${bookings.state} IN ('Активная', 'Новая', 'Подтверждена')`,
          sql`${bookings.status} IN ('active', 'confirmed', 'in_rent', 'Активная', 'Новая', 'Подтверждена')`
        )
      )
    );
  
  // Основной запрос: машины не в активных бронях
  const availableCars = await db
    .select()
    .from(cars)
    .where(
      and(
        notInArray(cars.id, activeBookings),
        eq(cars.branch_code, branchCode)
      )
    )
    .orderBy(cars.plate);
  
  return availableCars;
}

// Использование
const available = await findAvailableCars(
  new Date('2025-11-10T16:00:00+04:00'),
  new Date('2025-11-15T14:30:00+04:00'),
  'tbilisi'
);

console.log(`Найдено свободных машин: ${available.length}`);
```

---

## 📊 Статистика и отчеты

### Распределение броней по статусам

```sql
SELECT 
  state,
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM bookings
GROUP BY state, status
ORDER BY count DESC;
```

### Активные брони на сегодня

```sql
SELECT 
  b.id,
  c.plate,
  cl.name as client_name,
  b.start_at,
  b.end_at,
  b.state,
  b.status
FROM bookings b
JOIN cars c ON b.car_id = c.id
JOIN clients cl ON b.client_id = cl.id
WHERE (
  (b.start_at <= NOW() AND b.end_at >= NOW())
  OR (b.start_date::timestamptz <= NOW() AND b.end_date::timestamptz >= NOW())
)
AND (
  b.state IN ('Активная', 'Новая', 'Подтверждена')
  OR b.status IN ('active', 'confirmed', 'in_rent')
)
ORDER BY b.start_at;
```

### Брони с проблемами (NULL или несинхронизация)

```sql
SELECT 
  id,
  start_date IS NULL as missing_start_date,
  end_date IS NULL as missing_end_date,
  start_at IS NULL as missing_start_at,
  end_at IS NULL as missing_end_at,
  state IS NULL as missing_state,
  status IS NULL as missing_status,
  CASE 
    WHEN start_date IS NOT NULL AND start_at IS NOT NULL 
         AND start_date::timestamptz != start_at 
    THEN true 
    ELSE false 
  END as dates_mismatch
FROM bookings
WHERE start_date IS NULL 
   OR end_date IS NULL 
   OR start_at IS NULL 
   OR end_at IS NULL
   OR state IS NULL
   OR status IS NULL
   OR (start_date IS NOT NULL AND start_at IS NOT NULL AND start_date::timestamptz != start_at);
```

---

## 🧪 Тестирование

### Тест 1: Создание с timestamp

```typescript
import { db } from './db';
import { bookings } from './db/schema';

test('Триггер заполняет text поля из timestamp', async () => {
  const booking = await db.insert(bookings).values({
    car_id: testCarId,
    start_at: new Date('2025-11-10T16:00:00+04:00'),
    end_at: new Date('2025-11-15T14:30:00+04:00'),
    status: 'active'
  }).returning();
  
  expect(booking[0].start_date).toBe('2025-11-10 16:00:00+04');
  expect(booking[0].end_date).toBe('2025-11-15 14:30:00+04');
  expect(booking[0].state).toBe('Активная');
});
```

### Тест 2: Создание с text

```typescript
test('Триггер заполняет timestamp из text', async () => {
  const booking = await db.insert(bookings).values({
    car_id: testCarId,
    start_date: '2025-11-10 16:00:00+04',
    end_date: '2025-11-15 14:30:00+04',
    state: 'Подтверждена'
  }).returning();
  
  expect(booking[0].start_at).toEqual(new Date('2025-11-10T16:00:00+04:00'));
  expect(booking[0].end_at).toEqual(new Date('2025-11-15T14:30:00+04:00'));
  expect(booking[0].status).toBe('confirmed');
});
```

### Тест 3: Обновление

```typescript
test('Триггер синхронизирует при UPDATE', async () => {
  // Создаем с только timestamp
  const booking = await db.insert(bookings).values({
    car_id: testCarId,
    start_at: new Date('2025-11-10T16:00:00+04:00'),
    end_at: new Date('2025-11-15T14:30:00+04:00'),
    status: 'active'
  }).returning();
  
  // Обновляем только state
  const updated = await db.update(bookings)
    .set({ state: 'Подтверждена' })
    .where(eq(bookings.id, booking[0].id))
    .returning();
  
  // Проверяем что status тоже обновился
  expect(updated[0].status).toBe('confirmed');
});
```

---

## 🔧 Утилиты

### Функция проверки консистентности

```typescript
async function checkBookingConsistency(bookingId: string) {
  const booking = await db.select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);
  
  if (!booking[0]) {
    throw new Error('Booking not found');
  }
  
  const issues: string[] = [];
  
  // Проверка дат
  if (!booking[0].start_date) issues.push('Missing start_date');
  if (!booking[0].end_date) issues.push('Missing end_date');
  if (!booking[0].start_at) issues.push('Missing start_at');
  if (!booking[0].end_at) issues.push('Missing end_at');
  
  // Проверка синхронизации дат
  if (booking[0].start_date && booking[0].start_at) {
    const startDateTs = new Date(booking[0].start_date);
    if (startDateTs.getTime() !== booking[0].start_at.getTime()) {
      issues.push('start_date and start_at mismatch');
    }
  }
  
  // Проверка статусов
  if (!booking[0].state) issues.push('Missing state');
  if (!booking[0].status) issues.push('Missing status');
  
  return {
    consistent: issues.length === 0,
    issues
  };
}

// Использование
const result = await checkBookingConsistency(bookingId);
if (!result.consistent) {
  console.error('Проблемы с бронью:', result.issues);
}
```

---

## 📝 Лучшие практики

### ✅ DO: Заполняйте оба формата

```typescript
// ПРАВИЛЬНО
const booking = {
  start_date: '2025-11-10 16:00:00+04',
  start_at: new Date('2025-11-10T16:00:00+04:00'),
  state: 'Активная',
  status: 'active'
};
```

### ❌ DON'T: Не полагайтесь только на триггер

```typescript
// РАБОТАЕТ, но НЕ РЕКОМЕНДУЕТСЯ
const booking = {
  start_at: new Date('2025-11-10T16:00:00+04:00'),
  status: 'active'
  // Триггер заполнит start_date и state
  // Но это неоптимально для импорта больших данных
};
```

### ✅ DO: Валидируйте формат

```typescript
function isValidDateFormat(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[+-]\d{2}$/.test(dateStr);
}

if (!isValidDateFormat(booking.start_date)) {
  throw new Error('Invalid date format');
}
```

### ✅ DO: Используйте типы

```typescript
type BookingStatus = 'active' | 'confirmed' | 'in_rent' | 'completed' | 'cancelled' | 'pending';
type BookingState = 'Активная' | 'Новая' | 'Подтверждена' | 'Отъездила' | 'Отмена' | 'Отказ клиента' | 'Недозвон' | 'Не подтверждена';

interface NormalizedBooking {
  start_date: string; // YYYY-MM-DD HH24:MI:SS+TZ
  end_date: string;
  start_at: Date;
  end_at: Date;
  state: BookingState;
  status: BookingStatus;
}
```

---

**Версия:** 1.0.0  
**Дата:** 10 ноября 2025  
**Статус:** ✅ Готово

