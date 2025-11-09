# 🤖 Рекомендации для стороннего бота - Финальная версия

**Дата:** 2025-11-09  
**Версия:** 2.0

---

## 🎯 Главные проблемы в запросе бота (найденные)

### 1️⃣ Выбор периода цен ❌

**Проблема:** Бот всегда берет `items[0]` (период "1-2 дня"), даже если аренда на 3 дня.

**Пример:**
- Аренда: 12-15 ноября (3 дня)
- Бот показывает: 91 GEL/день (период "1-2 дня")
- Должен показать: цену для периода "3-4 дня"

**Решение:**

```javascript
function findPriceForDays(items, daysCount) {
  for (let item of items) {
    // Парсим период "1 - 2" → min=1, max=2
    const [min, max] = item.period.split(' - ').map(s => parseInt(s.trim()));
    
    // Проверяем попадание
    if (daysCount >= min && daysCount <= max) {
      return item;
    }
  }
  
  // Если не нашли, берем последний (самый длительный)
  return items[items.length - 1];
}

// Использование:
const startDate = new Date('2025-11-12T12:00:00+04:00');
const endDate = new Date('2025-11-15T12:00:00+04:00');
const daysCount = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)); // 3

const correctPeriod = findPriceForDays(priceData.items, daysCount);
const priceGEL = correctPeriod.price_gel;
const priceUSD = correctPeriod.price_usd;
```

---

### 2️⃣ Нет фильтрации машин без установленных цен ⚠️

**Проблема:** В БД есть 20 машин без цен или с ценами ≤10 GEL.

**Решение - добавить фильтр:**

```javascript
// После получения price_values
let priceData = priceRow.price_values;
if (typeof priceData === 'string') {
  priceData = JSON.parse(priceData);
}

if (!priceData?.items || priceData.items.length === 0) {
  continue; // Нет данных о ценах
}

const firstPeriod = priceData.items[0];
const priceGEL = firstPeriod.price_gel || firstPeriod.price_per_day;

// ✅ ДОБАВИТЬ ФИЛЬТР:
if (priceGEL <= 10) {
  console.warn(`Пропускаю ${car.model}: цена не установлена (${priceGEL} GEL)`);
  continue;
}
```

**Или в SQL:**

```sql
SELECT cp.price_values
FROM car_prices cp
WHERE cp.car_id = $1
  AND (cp.price_values->'items'->0->>'price_gel')::numeric > 10
ORDER BY season_id
LIMIT 1;
```

---

### 3️⃣ Расчет количества дней ⚠️

**Проблема:** Если используется `Math.floor`, может дать 2 вместо 3 дней.

**Решение:**

```javascript
// ❌ НЕПРАВИЛЬНО:
const days = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));

// ✅ ПРАВИЛЬНО для аренды (округляем вверх):
const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

// Пример:
// 12 ноября 12:00 → 15 ноября 12:00 = 3 дня
```

---

## 📋 Полный исправленный код

```javascript
async function searchCars(branch, startDate, endDate, maxPriceUSD) {
  const client = new pg.Client({
    connectionString: CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  try {
    // 1. Рассчитать количество дней ПРАВИЛЬНО
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysCount = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    // 2. Получить ID филиала
    const branchResult = await client.query(
      'SELECT id FROM branches WHERE code = $1',
      [branch]
    );
    const branchId = branchResult.rows[0].id;
    
    // 3. Получить доступные машины (state = 1)
    const carsResult = await client.query(`
      SELECT 
        c.id, c.model, c.plate, c.year, c.transmission, c.fuel
      FROM cars c
      WHERE c.branch_id = $1 AND c.state = 1
      ORDER BY c.model
    `, [branchId]);
    
    const results = [];
    
    // 4. Обработать каждую машину
    for (const car of carsResult.rows) {
      // Проверка броней
      const bookingCheck = await client.query(`
        SELECT COUNT(*) as count
        FROM bookings
        WHERE car_id = $1
          AND status IN ('active', 'confirmed', 'in_rent')
          AND (
            (start_at < $3::timestamptz AND end_at > $2::timestamptz)
          )
      `, [car.id, startDate, endDate]);
      
      if (bookingCheck.rows[0].count > 0) continue; // Занята
      
      // Получить цены С ФИЛЬТРОМ
      const priceResult = await client.query(`
        SELECT price_values
        FROM car_prices
        WHERE car_id = $1
          AND (price_values->'items'->0->>'price_gel')::numeric > 10
        ORDER BY season_id
        LIMIT 1
      `, [car.id]);
      
      if (priceResult.rows.length === 0) continue;
      
      let priceData = priceResult.rows[0].price_values;
      if (typeof priceData === 'string') {
        priceData = JSON.parse(priceData);
      }
      
      if (!priceData?.items) continue;
      
      // ✅ НАЙТИ ПРАВИЛЬНЫЙ ПЕРИОД
      const correctPeriod = findPriceForDays(priceData.items, daysCount);
      
      const priceGEL = correctPeriod.price_gel;
      const priceUSD = correctPeriod.price_usd || (priceGEL / 2.7);
      
      // Двойная проверка
      if (priceGEL <= 10) continue;
      
      // Применить ценовой фильтр
      if (maxPriceUSD && priceUSD > maxPriceUSD) continue;
      
      results.push({
        model: car.model,
        plate: car.plate,
        year: car.year,
        transmission: car.transmission,
        fuel: car.fuel,
        priceGEL,
        priceUSD: Math.round(priceUSD * 100) / 100,
        totalGEL: priceGEL * daysCount,
        totalUSD: Math.round(priceUSD * daysCount * 100) / 100,
        daysCount,
        period: correctPeriod.period
      });
    }
    
    results.sort((a, b) => a.priceGEL - b.priceGEL);
    return results;
    
  } finally {
    await client.end();
  }
}

// Функция поиска правильного периода
function findPriceForDays(items, daysCount) {
  for (let item of items) {
    const [min, max] = item.period.split(' - ').map(s => parseInt(s.trim()));
    if (daysCount >= min && daysCount <= max) {
      return item;
    }
  }
  return items[items.length - 1];
}
```

---

## 🔄 Автоматическое обновление цен

### Хорошая новость ✅

Мы настроили **автоматическую ежедневную синхронизацию цен** в 3:00 утра.

**Что это значит:**
- ✅ Цены всегда актуальны (обновляются каждый день)
- ✅ Новые машины автоматически получают цены
- ✅ Изменения цен в RentProg отражаются в БД
- ✅ Машин без цен будет становиться меньше

**Для бота это означает:**
- Нет необходимости самому синхронизировать цены
- Можно просто читать из БД
- Если машины нет в результатах - она либо занята, либо нет цен

---

## 📊 Машины без цен (20 штук)

Эти машины **не будут показываться** боту, пока не появятся цены:

**Тбилиси (9):**
- BMW 430i Cabrio (IV430AN)
- Chevrolet Cruze HR (BZ551ZB)
- Honda HR-V (RV933RR)
- Honda Odyssey (CR106CR)
- Mazda 3 (NN371KN)
- Mazda 6 (NN626CC)
- Toyota Rav 4 (EP021EP)
- Toyota Rav 4 (JU904UU)
- Volkswagen Tiguan (GT183GG)

**Сервисный центр (5), Кутаиси (3), Батуми (2), Без филиала (1)**

**Причина:** Эти машины не найдены в RentProg или у них не установлены цены там.

---

## 💡 Дополнительные рекомендации

### 1. Session ID для контекста чатов

Используйте формат:
```
<chatId>:<threadId>:<slug>
```

**Примеры:**
```
123456789:0:car-search           # Основной чат
123456789:42:booking-details     # Тема 42
-1001234567:0:availability       # Группа
```

### 2. Кэширование

Для производительности добавьте кэш:

```javascript
const cache = new Map();
const CACHE_TTL = 60000; // 1 минута

async function getCachedBranches() {
  const key = 'branches';
  const cached = cache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const branches = await client.query('SELECT code, name FROM branches');
  cache.set(key, { data: branches.rows, timestamp: Date.now() });
  
  return branches.rows;
}
```

### 3. Connection Pooling

```javascript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: CONNECTION_STRING,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: { rejectUnauthorized: false }
});

// Использование
const result = await pool.query('SELECT ...');
```

### 4. Rate Limiting

Ограничьте частоту запросов:

```javascript
const RateLimiter = require('limiter').RateLimiter;
const limiter = new RateLimiter({ tokensPerInterval: 10, interval: 'second' });

async function searchWithRateLimit(...args) {
  await limiter.removeTokens(1);
  return await searchCars(...args);
}
```

---

## 📞 Контакты

При возникновении проблем с БД или ценами:
- Проверьте таблицу `car_prices`
- Проверьте что цены актуальны (поле `updated_at`)
- Свяжитесь с командой GeoDrive

---

## 🎯 Итоговый чек-лист для бота

- [ ] Добавлена функция `findPriceForDays()`
- [ ] Используется `Math.ceil()` для подсчета дней
- [ ] Добавлен фильтр `priceGEL > 10`
- [ ] Проверяется тип `price_values` (string → JSON)
- [ ] Показывается итоговая цена за весь период
- [ ] Добавлен connection pooling
- [ ] Добавлено кэширование (опционально)
- [ ] Добавлен rate limiting (опционально)

---

**Документация обновлена:** 2025-11-09  
**Версия:** 2.0 (с учетом автоматической синхронизации)  
**Статус:** ✅ Готово к использованию

