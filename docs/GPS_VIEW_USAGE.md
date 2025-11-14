# Использование VIEW `gps_tracking_with_labels` в Telegram боте

## 📖 Что это?

`gps_tracking_with_labels` — это **VIEW** (виртуальная таблица), которая автоматически добавляет человекопонятные русские названия к статусам GPS.

**Вместо:**
```sql
SELECT status FROM gps_tracking;
-- Результат: "moving", "offline"
```

**Теперь:**
```sql
SELECT status_display FROM gps_tracking_with_labels;
-- Результат: "🟢 Едет", "🔴 Нет связи"
```

---

## 🚀 Быстрый старт

### 1. Применить миграцию

```bash
# Один раз выполнить:
node setup/apply_gps_labels_migration.mjs
```

Это создаст:
- ✅ Таблицу `gps_status_labels` (справочник)
- ✅ VIEW `gps_tracking_with_labels`
- ✅ Индексы для быстрых запросов

---

## 📊 Структура VIEW

### Все поля из `gps_tracking` + новые поля:

| Поле | Тип | Описание | Пример |
|------|-----|----------|--------|
| `status` | TEXT | Технический код (как раньше) | `moving` |
| **`status_label`** | TEXT | Русское название | `Едет` |
| **`status_emoji`** | TEXT | Эмодзи | `🟢` |
| **`status_category`** | TEXT | Категория | `active` |
| **`status_description`** | TEXT | Описание | `Машина в движении` |
| **`status_display`** | TEXT | Полное отображение | `🟢 Едет` |

---

## 💻 Использование в коде

### Пример 1: Получить данные машины для Telegram

```typescript
// src/services/telegram-bot.ts
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

async function getCarInfoForTelegram(carId: string) {
  const [car] = await sql`
    SELECT 
      car_id,
      status_display,     -- "🟢 Едет"
      status_category,    -- "active"
      speed,
      battery_voltage,
      lat,
      lng,
      updated_at
    FROM gps_tracking_with_labels
    WHERE car_id = ${carId}
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  
  return car;
}

// Использование:
const car = await getCarInfoForTelegram('uuid-машины');
const message = `
🚗 Maserati levante SQ4
📊 Статус: ${car.status_display}
⚡ Скорость: ${car.speed} км/ч
🔋 Напряжение: ${car.battery_voltage.toFixed(1)} В
🕐 Обновлено: ${car.updated_at.toLocaleString('ru-RU')}
`;

await bot.sendMessage(chatId, message);
```

**Результат в Telegram:**
```
🚗 Maserati levante SQ4
📊 Статус: 🟢 Едет
⚡ Скорость: 69 км/ч
🔋 Напряжение: 12.7 В
🕐 Обновлено: 14.11.2025, 10:28
```

---

### Пример 2: Список всех машин

```typescript
async function getAllCarsForTelegram() {
  const cars = await sql`
    SELECT 
      c.plate,
      c.make,
      c.model,
      gt.status_display,
      gt.speed,
      gt.battery_voltage
    FROM cars c
    LEFT JOIN LATERAL (
      SELECT * 
      FROM gps_tracking_with_labels 
      WHERE car_id = c.id 
      ORDER BY updated_at DESC 
      LIMIT 1
    ) gt ON true
    ORDER BY gt.status_category, c.plate
  `;
  
  let message = '📊 Список машин:\n\n';
  
  for (const car of cars) {
    message += `${car.status_display} ${car.plate}`;
    if (car.speed > 0) {
      message += ` (${car.speed} км/ч)`;
    }
    message += '\n';
  }
  
  return message;
}
```

**Результат в Telegram:**
```
📊 Список машин:

🟢 Едет WQ686WQ (69 км/ч)
🟢 Едет LL464LL (87 км/ч)
🟠 Стоит (заведена) WQ603WQ
⚪ Припаркована WQ421WQ
⚪ Припаркована WQ422WQ
🟡 Слабый GPS LL777LL
🔴 Нет связи WQ999WQ
```

---

### Пример 3: Статистика автопарка

```typescript
async function getFleetStatistics() {
  const stats = await sql`
    SELECT 
      status_display,
      status_category,
      COUNT(*) as count,
      ROUND(AVG(speed)::numeric, 1) as avg_speed
    FROM gps_tracking_with_labels
    WHERE updated_at > NOW() - INTERVAL '1 hour'
    GROUP BY status_display, status_category, status
    ORDER BY status_category, count DESC
  `;
  
  let message = '📊 Статистика автопарка:\n\n';
  
  let prevCategory = '';
  for (const stat of stats) {
    if (stat.status_category !== prevCategory) {
      message += '\n';
      prevCategory = stat.status_category;
    }
    
    message += `${stat.status_display}: ${stat.count}`;
    if (stat.avg_speed > 0) {
      message += ` (ср. ${stat.avg_speed} км/ч)`;
    }
    message += '\n';
  }
  
  return message;
}
```

**Результат в Telegram:**
```
📊 Статистика автопарка:

🟢 Едет: 6 (ср. 72.3 км/ч)
🟠 Стоит (заведена): 2

⚪ Припаркована: 93

🟡 Слабый GPS: 3
🔴 Нет связи: 15
```

---

### Пример 4: Алерт при изменении статуса

```typescript
async function checkStatusChanges() {
  // Получить машины, у которых статус изменился за последние 5 минут
  const changes = await sql`
    WITH latest AS (
      SELECT DISTINCT ON (car_id)
        car_id,
        status,
        status_display,
        updated_at
      FROM gps_tracking_with_labels
      ORDER BY car_id, updated_at DESC
    ),
    previous AS (
      SELECT DISTINCT ON (car_id)
        car_id,
        status as old_status,
        status_display as old_status_display
      FROM gps_tracking_with_labels
      WHERE updated_at < NOW() - INTERVAL '5 minutes'
      ORDER BY car_id, updated_at DESC
    )
    SELECT 
      c.plate,
      c.make,
      c.model,
      l.status_display as new_status,
      p.old_status_display as old_status
    FROM latest l
    JOIN previous p ON l.car_id = p.car_id
    JOIN cars c ON l.car_id = c.id
    WHERE l.status != p.old_status
    AND l.updated_at > NOW() - INTERVAL '5 minutes'
  `;
  
  for (const change of changes) {
    const message = `
🔔 Изменение статуса

🚗 ${change.make} ${change.model} — ${change.plate}

Было: ${change.old_status}
Стало: ${change.new_status}
    `;
    
    await bot.sendMessage(alertChatId, message);
  }
}
```

---

## 🔍 Полезные запросы

### Активные машины (едут или с зажиганием)

```sql
SELECT plate, status_display, speed
FROM cars c
JOIN gps_tracking_with_labels gt ON c.id = gt.car_id
WHERE gt.status_category = 'active'
ORDER BY gt.speed DESC;
```

### Недоступные машины (нет связи или GPS)

```sql
SELECT plate, status_display, updated_at
FROM cars c
JOIN gps_tracking_with_labels gt ON c.id = gt.car_id
WHERE gt.status_category = 'unavailable'
ORDER BY gt.updated_at DESC;
```

### Машины, которые долго стоят

```sql
SELECT 
  c.plate,
  gt.status_display,
  gt.battery_voltage,
  EXTRACT(EPOCH FROM (NOW() - gt.updated_at))/3600 as hours_parked
FROM cars c
JOIN gps_tracking_with_labels gt ON c.id = gt.car_id
WHERE gt.status = 'parked_off'
AND gt.updated_at < NOW() - INTERVAL '24 hours'
ORDER BY hours_parked DESC;
```

---

## 🎨 Кастомизация названий

### Изменить название статуса

```sql
-- Изменить "Едет" на "В движении"
UPDATE gps_status_labels
SET label = 'В движении'
WHERE code = 'moving';

-- Изменения применятся МГНОВЕННО во всех запросах!
```

### Добавить новый статус (если появится)

```sql
-- Использовать готовую функцию
SELECT add_gps_status_label(
  'new_status',           -- код
  'Новый статус',         -- название
  '🟣',                   -- эмодзи
  'active',               -- категория
  'Описание статуса'      -- описание (опционально)
);
```

---

## 🌐 Мультиязычность (будущее)

Если нужна поддержка нескольких языков:

```sql
-- 1. Изменить структуру справочника
ALTER TABLE gps_status_labels 
ADD COLUMN lang TEXT DEFAULT 'ru';

ALTER TABLE gps_status_labels
DROP CONSTRAINT gps_status_labels_pkey,
ADD PRIMARY KEY (code, lang);

-- 2. Добавить английские названия
INSERT INTO gps_status_labels (code, lang, label, emoji, category) VALUES
  ('moving', 'en', 'Moving', '🟢', 'active'),
  ('offline', 'en', 'Offline', '🔴', 'unavailable');

-- 3. Создать функцию для получения названия на нужном языке
CREATE OR REPLACE VIEW gps_tracking_with_labels_en AS
SELECT 
  gt.*,
  sl.label AS status_label,
  sl.emoji AS status_emoji,
  (sl.emoji || ' ' || sl.label) AS status_display
FROM gps_tracking gt
LEFT JOIN gps_status_labels sl ON gt.status = sl.code AND sl.lang = 'en';
```

---

## ⚡ Производительность

### Индексы созданы автоматически:

```sql
-- Для JOIN по статусу
CREATE INDEX idx_gps_tracking_status ON gps_tracking(status);

-- Для поиска последних данных по машине
CREATE INDEX idx_gps_tracking_car_updated ON gps_tracking(car_id, updated_at DESC);
```

### Скорость запросов:

- ✅ **JOIN по статусу:** < 1ms (индекс)
- ✅ **Справочник:** 5 строк (кешируется в памяти)
- ✅ **VIEW:** нет накладных расходов (просто алиас для JOIN)

---

## 🐛 Troubleshooting

### Ошибка: "relation gps_tracking_with_labels does not exist"

**Решение:** Применить миграцию:
```bash
node setup/apply_gps_labels_migration.mjs
```

### Статус показывает NULL

**Причина:** В `gps_tracking.status` есть значение, которого нет в справочнике.

**Решение:** Добавить в справочник:
```sql
SELECT add_gps_status_label('unknown_status', 'Неизвестно', '⚫', 'unavailable');
```

### Медленные запросы

**Проверить индексы:**
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'gps_tracking';
```

---

## 📚 Связанные файлы

- `migrations/add_gps_status_labels.sql` — SQL миграция
- `setup/apply_gps_labels_migration.mjs` — Скрипт применения
- `src/types/gps-status.ts` — TypeScript типы (для валидации)
- `src/examples/telegram-gps-status-example.ts` — Примеры использования
- `docs/GPS_STATUSES.md` — Полная документация статусов

---

## ✅ Checklist для агента, который делает вывод в Telegram

- [ ] Применил миграцию: `node setup/apply_gps_labels_migration.mjs`
- [ ] Заменил все запросы к `gps_tracking` на `gps_tracking_with_labels`
- [ ] Использую `status_display` для вывода в Telegram
- [ ] Использую `status_category` для группировки машин
- [ ] Не храню русские названия в коде (только в БД)
- [ ] При добавлении нового статуса обновляю справочник, а не код

---

**Дата создания:** 14.11.2025  
**Автор:** AI Agent (Cursor)  
**Версия:** 1.0

