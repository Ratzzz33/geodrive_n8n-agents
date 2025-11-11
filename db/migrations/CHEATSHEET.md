# 📝 ШПАРГАЛКА: Миграции нормализации данных броней

Быстрый справочник команд и примеров.

---

## ⚡ БЫСТРЫЕ КОМАНДЫ

### Проверка статуса

```bash
cd C:\Users\33pok\geodrive_n8n-agents\db\migrations
node check-status.mjs
# или
npm run check
```

### Применение миграций

```bash
# Все миграции
node apply-migrations.mjs
npm run migrate

# С проверкой (dry-run)
node apply-migrations.mjs --dry-run
npm run migrate:dry-run

# Одна миграция
node apply-migrations.mjs --single=001
npm run migrate:001

# Диапазон
node apply-migrations.mjs --from=002 --to=004
```

---

## 📋 СПИСОК МИГРАЦИЙ

| № | Команда | Что делает |
|---|---------|------------|
| 001 | `npm run migrate:001` | Добавляет поля start_date, end_date, state |
| 002 | `npm run migrate:002` | Нормализует даты (timestamp ↔ text) |
| 003 | `npm run migrate:003` | Нормализует статусы (рус ↔ англ) |
| 004 | `npm run migrate:004` | Создает триггер автосинхронизации |
| 005 | `npm run migrate:005` | Финальный бэкфилл данных |

---

## 💻 ПРИМЕРЫ КОДА

### Создание брони (TypeScript)

```typescript
// ✅ РЕКОМЕНДУЕТСЯ: Оба формата
const booking = await db.insert(bookings).values({
  car_id: carUuid,
  start_date: '2025-11-10 16:00:00+04',
  end_date: '2025-11-15 14:30:00+04',
  start_at: new Date('2025-11-10T16:00:00+04:00'),
  end_at: new Date('2025-11-15T14:30:00+04:00'),
  state: 'Активная',
  status: 'active'
});

// ✅ РАБОТАЕТ: Только timestamp (триггер заполнит остальное)
const booking = await db.insert(bookings).values({
  car_id: carUuid,
  start_at: new Date('2025-11-10T16:00:00+04:00'),
  end_at: new Date('2025-11-15T14:30:00+04:00'),
  status: 'active'
});
```

### Поиск свободных машин (SQL)

```sql
-- Проверка по обоим форматам
SELECT c.*
FROM cars c
WHERE c.id NOT IN (
  SELECT car_id FROM bookings
  WHERE (
    (start_at, end_at) OVERLAPS (?, ?)
    OR (start_date::timestamptz, end_date::timestamptz) OVERLAPS (?, ?)
  )
  AND (
    state IN ('Активная', 'Новая', 'Подтверждена')
    OR status IN ('active', 'confirmed', 'in_rent')
  )
)
```

---

## 🔧 SQL ПРОВЕРКИ

### Проверка NULL значений

```sql
-- Даты
SELECT COUNT(*) FROM bookings 
WHERE start_date IS NULL OR end_date IS NULL;

-- Статусы
SELECT COUNT(*) FROM bookings 
WHERE state IS NULL OR status IS NULL;
```

### Проверка синхронизации

```sql
-- Несинхронизированные даты
SELECT COUNT(*) FROM bookings 
WHERE start_date::timestamptz != start_at;

-- Несинхронизированные статусы (смотреть маппинг)
SELECT state, status, COUNT(*) 
FROM bookings 
GROUP BY state, status;
```

### Проверка триггера

```sql
-- Тест: создать бронь
INSERT INTO bookings (car_id, start_at, end_at, status) 
VALUES (
  (SELECT id FROM cars LIMIT 1),
  NOW() + INTERVAL '1 day',
  NOW() + INTERVAL '3 days',
  'active'
) RETURNING *;

-- Проверить автозаполнение
SELECT start_date, state FROM bookings ORDER BY created_at DESC LIMIT 1;
```

---

## 📊 СТАТУСЫ

### Маппинг

| Русский | Английский |
|---------|------------|
| Активная | active |
| Новая | active |
| Подтверждена | confirmed |
| Отъездила | completed |
| Отмена | cancelled |

### Активные статусы (для поиска)

```sql
-- Брони исключающие машины из поиска
WHERE (
  state IN ('Активная', 'Новая', 'Подтверждена')
  OR status IN ('active', 'confirmed', 'in_rent')
)
AND end_at >= NOW()
```

---

## 🔄 ОТКАТ

### Полный откат

```sql
BEGIN;
DROP TRIGGER IF EXISTS bookings_sync_fields_trigger ON bookings;
DROP FUNCTION IF EXISTS sync_booking_fields();
ALTER TABLE bookings DROP COLUMN IF EXISTS start_date;
ALTER TABLE bookings DROP COLUMN IF EXISTS end_date;
ALTER TABLE bookings DROP COLUMN IF EXISTS state;
COMMIT;
```

### Только триггер

```sql
DROP TRIGGER IF EXISTS bookings_sync_fields_trigger ON bookings;
DROP FUNCTION IF EXISTS sync_booking_fields();
```

---

## 🐛 TROUBLESHOOTING

### Ошибка: "relation does not exist"

```bash
node setup/create_base_schema.mjs
```

### Ошибка: "column already exists"

```bash
node db/migrations/apply-migrations.mjs --from=002
```

### Ошибка: "invalid input syntax"

```sql
-- Найти проблемные записи
SELECT id, start_date 
FROM bookings 
WHERE start_date !~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[+-]\d{2}$';
```

---

## 📚 ДОКУМЕНТАЦИЯ

| Файл | Для чего |
|------|----------|
| `QUICK_START.md` | Быстрый старт (5 минут) |
| `README.md` | Полная документация |
| `EXAMPLES.md` | Примеры кода |
| `INDEX.md` | Индекс миграций |
| `SUMMARY.md` | Краткая сводка |
| `CHEATSHEET.md` | Эта шпаргалка |

---

## ✅ ЧЕКЛИСТ

- [ ] Сделан бэкап БД
- [ ] Проверен статус (`npm run check`)
- [ ] Запущен dry-run (`npm run migrate:dry-run`)
- [ ] Применены миграции (`npm run migrate`)
- [ ] Проверен результат (`npm run check`)
- [ ] Протестирован триггер (CREATE тестовой брони)
- [ ] Проверен поиск автомобилей

---

**Версия:** 1.0.0  
**Дата:** 11 ноября 2025

