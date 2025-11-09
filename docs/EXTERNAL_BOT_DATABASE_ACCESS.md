# 🤖 Доступ к БД для стороннего бота - Полная документация

**Дата создания:** 2025-11-08  
**Версия:** 1.0  
**Статус:** ✅ Активен и протестирован

---

## 🔐 Данные для подключения (READ-ONLY)

### Connection String

```
postgresql://bot_readonly:qNMSE5wAiPKRDYxJ719DeX9nm6Y4xWr1@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### Компоненты

| Параметр | Значение |
|----------|----------|
| **Host** | `ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech` |
| **Database** | `neondb` |
| **Username** | `bot_readonly` |
| **Password** | `qNMSE5wAiPKRDYxJ719DeX9nm6Y4xWr1` |
| **SSL** | Required |

---

## 🛡️ Права доступа

### ✅ РАЗРЕШЕНО:
- **SELECT** - чтение из всех таблиц
- **Подключение** к базе данных neondb
- **Использование** схемы public

### ❌ ЗАПРЕЩЕНО:
- INSERT - создание записей
- UPDATE - изменение данных
- DELETE - удаление записей
- TRUNCATE - очистка таблиц
- DROP - удаление таблиц/схем
- CREATE - создание объектов
- ALTER - изменение структуры

**Проверено:** Все запрещающие операции протестированы и работают корректно ✅

---

## 📊 Структура БД - Основные таблицы

### 1. `branches` - Филиалы

```sql
SELECT 
  id,           -- UUID
  code,         -- 'tbilisi' | 'batumi' | 'kutaisi' | 'service-center'
  name,         -- 'Тбилиси' | 'Батуми' | 'Кутаиси' | 'Сервисный центр'
  company_id    -- ID в RentProg (9247, 9506, 9248, 11163)
FROM branches;
```

### 2. `cars` - Автомобили

```sql
SELECT 
  id,               -- UUID (PK)
  branch_id,        -- UUID (FK -> branches.id)
  plate,            -- Гос номер (напр. "BB542QB")
  vin,              -- VIN номер
  model,            -- Модель (напр. "Ford Fiesta")
  code,             -- Код машины (напр. "Ford Fiesta SE 542")
  year,             -- Год выпуска
  transmission,     -- 'Автомат' | 'Механика' | 'Вариатор'
  fuel,             -- 'Бензин 95' | 'Дизель' | 'Гибрид'
  car_class,        -- 'Эконом' | 'Средний' | 'Бизнес'
  car_type,         -- 'Седан' | 'Кроссовер' | 'Внедорожник'
  number_seats,     -- Количество мест
  drive_unit,       -- 'Передний' | 'Полный' | 'Задний'
  state,            -- 1 = доступна, 2+ = недоступна (КРИТИЧНО!)
  active            -- boolean
FROM cars
WHERE state = 1;  -- Только доступные машины
```

### 3. `car_prices` - Цены

```sql
SELECT 
  id,               -- UUID (PK)
  car_id,           -- UUID (FK -> cars.id)
  season_id,        -- ID сезона
  currency,         -- 'GEL'
  exchange_rate,    -- 2.7 (USD к GEL)
  price_values      -- JSONB с ценами по периодам
FROM car_prices;
```

**Структура `price_values` (JSONB):**

```json
{
  "currency": "GEL",
  "exchange_rate": 2.7,
  "periods": ["1 - 2", "3 - 4", "5 - 7", "8 - 15", "16 - 30"],
  "values": [96, 91, 85, 80, 69],
  "items": [
    {
      "period": "1 - 2",
      "price_per_day": 96,
      "price_gel": 96,
      "price_usd": 35.56,
      "currency": "GEL"
    }
  ],
  "season": {
    "start_date": "16.03",
    "end_date": "27.04"
  }
}
```

### 4. `bookings` - Брони

```sql
SELECT 
  id,               -- UUID (PK)
  branch_id,        -- UUID (FK -> branches.id)
  car_id,           -- UUID (FK -> cars.id)
  client_id,        -- UUID (FK -> clients.id)
  start_at,         -- TIMESTAMPTZ - начало аренды
  end_at,           -- TIMESTAMPTZ - конец аренды
  status,           -- 'active' | 'confirmed' | 'in_rent' | 'completed' | 'cancelled'
  price,            -- Цена за период
  total,            -- Итого
  deposit           -- Депозит
FROM bookings
WHERE status IN ('active', 'confirmed', 'in_rent');  -- Активные брони
```

---

## 💻 Примеры кода

### Node.js (pg)

```javascript
import pg from 'pg';
const { Client } = pg;

const CONNECTION_STRING = 'postgresql://bot_readonly:qNMSE5wAiPKRDYxJ719DeX9nm6Y4xWr1@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function searchCars(branch, startDate, endDate, maxPriceUSD) {
  const client = new Client({
    connectionString: CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  try {
    // 1. Получить ID филиала
    const branchResult = await client.query(
      'SELECT id FROM branches WHERE code = $1',
      [branch]
    );
    const branchId = branchResult.rows[0].id;
    
    // 2. Получить доступные машины (state = 1)
    const carsResult = await client.query(`
      SELECT 
        c.id, c.model, c.plate, c.year, c.transmission, c.fuel
      FROM cars c
      WHERE c.branch_id = $1 AND c.state = 1
      ORDER BY c.model
    `, [branchId]);
    
    const results = [];
    
    // 3. Проверить каждую машину
    for (const car of carsResult.rows) {
      // Проверка броней
      const bookingCheck = await client.query(`
        SELECT COUNT(*) as count
        FROM bookings
        WHERE car_id = $1
          AND status IN ('active', 'confirmed', 'in_rent')
          AND (
            (start_at <= $2::timestamptz AND end_at >= $2::timestamptz)
            OR (start_at <= $3::timestamptz AND end_at >= $3::timestamptz)
            OR (start_at >= $2::timestamptz AND end_at <= $3::timestamptz)
          )
      `, [car.id, startDate, endDate]);
      
      if (bookingCheck.rows[0].count > 0) continue; // Занята
      
      // Получить цены
      const priceResult = await client.query(`
        SELECT price_values
        FROM car_prices
        WHERE car_id = $1
        ORDER BY season_id
        LIMIT 1
      `, [car.id]);
      
      if (priceResult.rows.length === 0) continue;
      
      let priceData = priceResult.rows[0].price_values;
      if (typeof priceData === 'string') {
        priceData = JSON.parse(priceData);
      }
      
      const firstPeriod = priceData.items?.[0];
      if (!firstPeriod) continue;
      
      const priceUSD = firstPeriod.price_usd || (firstPeriod.price_gel / 2.7);
      
      if (maxPriceUSD && priceUSD > maxPriceUSD) continue;
      
      results.push({
        model: car.model,
        plate: car.plate,
        year: car.year,
        transmission: car.transmission,
        fuel: car.fuel,
        priceGEL: firstPeriod.price_gel,
        priceUSD: Math.round(priceUSD * 100) / 100
      });
    }
    
    results.sort((a, b) => a.priceGEL - b.priceGEL);
    return results;
    
  } finally {
    await client.end();
  }
}

// Использование
const cars = await searchCars(
  'tbilisi', 
  '2025-11-09T12:00:00+04:00', 
  '2025-11-15T12:00:00+04:00',
  45
);

console.log(`Найдено: ${cars.length} машин`);
cars.forEach(car => {
  console.log(`${car.model} - ${car.priceGEL} GEL/день (≈$${car.priceUSD})`);
});
```

### Python (psycopg2)

```python
import psycopg2
import json

CONNECTION_STRING = "postgresql://bot_readonly:qNMSE5wAiPKRDYxJ719DeX9nm6Y4xWr1@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def search_cars(branch, start_date, end_date, max_price_usd=None):
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()
    
    try:
        # Получить ID филиала
        cur.execute("SELECT id FROM branches WHERE code = %s", (branch,))
        branch_id = cur.fetchone()[0]
        
        # Получить доступные машины
        cur.execute("""
            SELECT id, model, plate, year, transmission, fuel
            FROM cars
            WHERE branch_id = %s AND state = 1
            ORDER BY model
        """, (branch_id,))
        
        results = []
        
        for car in cur.fetchall():
            car_id = car[0]
            
            # Проверка броней
            cur.execute("""
                SELECT COUNT(*) 
                FROM bookings
                WHERE car_id = %s
                  AND status IN ('active', 'confirmed', 'in_rent')
                  AND (
                    (start_at <= %s::timestamptz AND end_at >= %s::timestamptz)
                    OR (start_at <= %s::timestamptz AND end_at >= %s::timestamptz)
                    OR (start_at >= %s::timestamptz AND end_at <= %s::timestamptz)
                  )
            """, (car_id, start_date, start_date, end_date, end_date, start_date, end_date))
            
            if cur.fetchone()[0] > 0:
                continue
            
            # Получить цены
            cur.execute("""
                SELECT price_values
                FROM car_prices
                WHERE car_id = %s
                ORDER BY season_id
                LIMIT 1
            """, (car_id,))
            
            price_row = cur.fetchone()
            if not price_row:
                continue
            
            price_data = price_row[0]
            if isinstance(price_data, str):
                price_data = json.loads(price_data)
            
            first_period = price_data.get('items', [{}])[0]
            price_gel = first_period.get('price_gel', 0)
            price_usd = first_period.get('price_usd', price_gel / 2.7)
            
            if max_price_usd and price_usd > max_price_usd:
                continue
            
            results.append({
                'model': car[1],
                'plate': car[2],
                'year': car[3],
                'transmission': car[4],
                'fuel': car[5],
                'price_gel': price_gel,
                'price_usd': round(price_usd, 2)
            })
        
        results.sort(key=lambda x: x['price_gel'])
        return results
        
    finally:
        cur.close()
        conn.close()

# Использование
cars = search_cars('tbilisi', '2025-11-09T12:00:00+04:00', '2025-11-15T12:00:00+04:00', 45)
print(f"Найдено: {len(cars)} машин")
```

---

## 🔑 SQL Запросы - Готовые шаблоны

### Запрос 1: Список всех филиалов

```sql
SELECT code, name, company_id 
FROM branches 
ORDER BY code;
```

### Запрос 2: Доступные машины филиала

```sql
-- Параметры: $1 = branch_code (напр. 'tbilisi')

SELECT 
  c.id, c.model, c.plate, c.code, c.year, 
  c.transmission, c.car_class, c.number_seats, c.fuel
FROM cars c
JOIN branches b ON b.id = c.branch_id
WHERE b.code = $1 AND c.state = 1
ORDER BY c.model;
```

### Запрос 3: Проверка броней машины

```sql
-- Параметры: 
-- $1 = car_id
-- $2 = start_date (напр. '2025-11-09T12:00:00+04:00')
-- $3 = end_date (напр. '2025-11-15T12:00:00+04:00')

SELECT 
  id, start_at, end_at, status
FROM bookings
WHERE car_id = $1
  AND status IN ('active', 'confirmed', 'in_rent')
  AND (
    (start_at <= $2::timestamptz AND end_at >= $2::timestamptz)
    OR (start_at <= $3::timestamptz AND end_at >= $3::timestamptz)
    OR (start_at >= $2::timestamptz AND end_at <= $3::timestamptz)
  );
```

### Запрос 4: Цены машины

```sql
-- Параметр: $1 = car_id

SELECT 
  currency,
  exchange_rate,
  price_values
FROM car_prices
WHERE car_id = $1
ORDER BY season_id
LIMIT 1;
```

---

## 💬 Session ID для контекста (Telegram)

Для сохранения контекста разговора в чатах используйте формат:

```
<chatId>:<threadId>:<slug>
```

**Примеры:**
```
123456789:0:car-search           # Основной чат
123456789:42:booking-details     # Тема 42
-1001234567:0:availability       # Группа
```

**Компоненты:**
- `chatId` - ID чата/группы Telegram
- `threadId` - ID темы (0 для основного чата)
- `slug` - контекст разговора (car-search, booking, help и т.д.)

---

## 📊 Важные константы

```javascript
// Курс валют
const USD_TO_GEL = 2.7;

// Коды филиалов
const BRANCHES = {
  'tbilisi': 'Тбилиси',
  'batumi': 'Батуми',
  'kutaisi': 'Кутаиси',
  'service-center': 'Сервисный центр'
};

// Статусы активных броней
const ACTIVE_BOOKING_STATUSES = ['active', 'confirmed', 'in_rent'];

// Доступные машины
const AVAILABLE_CAR_STATE = 1;
```

---

## 🚨 Важные замечания

### 1. Проверка доступности машины

**Машина доступна ТОЛЬКО если:**
- ✅ `state = 1` (критично!)
- ✅ Нет активных броней на выбранные даты
- ✅ Есть цены в `car_prices`

### 2. Парсинг `price_values`

⚠️ **ВАЖНО:** Поле `price_values` может возвращаться как строка!

```javascript
let priceData = row.price_values;
if (typeof priceData === 'string') {
  priceData = JSON.parse(priceData);
}
```

### 3. Проверка пересечения дат

Используйте правильную логику для проверки броней:

```sql
WHERE (
  (start_at <= $2 AND end_at >= $2)      -- Бронь начинается до и заканчивается после начала
  OR (start_at <= $3 AND end_at >= $3)   -- Бронь начинается до и заканчивается после конца
  OR (start_at >= $2 AND end_at <= $3)   -- Бронь полностью внутри периода
)
```

---

## 🔄 Управление доступом

### Отзыв доступа (выполняется администратором)

```sql
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM bot_readonly;
REVOKE USAGE ON SCHEMA public FROM bot_readonly;
REVOKE CONNECT ON DATABASE neondb FROM bot_readonly;
DROP USER bot_readonly;
```

### Смена пароля (выполняется администратором)

```sql
ALTER USER bot_readonly WITH PASSWORD 'новый_пароль';
```

---

## 📞 Поддержка

При возникновении проблем:
1. Проверьте connection string
2. Убедитесь, что SSL включен (`sslmode=require`)
3. Проверьте, что делаете только SELECT запросы
4. Свяжитесь с командой GeoDrive

---

**Документация создана:** 2025-11-08  
**Последнее обновление:** 2025-11-08  
**Статус:** ✅ Протестирован и готов к использованию

