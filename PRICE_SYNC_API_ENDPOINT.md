# 🔄 Endpoint для синхронизации цен

## Код для добавления в `src/api/index.ts`

```typescript
// GET /sync-prices/:branch - Синхронизация цен для филиала
app.get('/sync-prices/:branch', async (req, res) => {
  const { branch } = req.params;
  
  console.log(`[Price Sync] Starting sync for ${branch}...`);
  
  try {
    // Импортируем функцию из setup (или переносим в src/modules)
    const { syncPricesForBranch } = await import('../setup/sync_prices_module.mjs');
    
    const result = await syncPricesForBranch(branch);
    
    res.json({
      ok: true,
      branch,
      inserted: result.inserted,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors
    });
    
  } catch (error) {
    console.error(`[Price Sync] Error for ${branch}:`, error);
    res.status(500).json({
      ok: false,
      branch,
      error: error.message
    });
  }
});
```

---

## Создать модуль `setup/sync_prices_module.mjs`

```javascript
/**
 * Модуль синхронизации цен для использования из API
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const BRANCH_TOKENS = {
  'tbilisi': process.env.RENTPROG_TOKEN_TBILISI || 'HHVxEiZJpFfWu2oDp5iZ7MxJrNXEMWLu',
  'batumi': process.env.RENTPROG_TOKEN_BATUMI || 'HbIBFRY0QBVC9I0fCOdXjLjO2J1fRzUH',
  'kutaisi': process.env.RENTPROG_TOKEN_KUTAISI || 'C8cK7w0vG3KJzVb1YRt3C6UrF7zZEH9Y',
  'service-center': process.env.RENTPROG_TOKEN_SERVICE_CENTER || '3PUAyNAGjYdU7n5wUmLe2lPMpWRwpQVZ'
};

const BASE_URL = 'https://rentprog.net/api/v1/public';

// Получить request token
async function getRequestToken(branch) {
  const companyToken = BRANCH_TOKENS[branch];
  if (!companyToken) {
    throw new Error(`Unknown branch: ${branch}`);
  }

  const response = await fetch(`${BASE_URL}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Company-Token': companyToken
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get token: ${response.status}`);
  }

  const data = await response.json();
  return data.token;
}

// Получить машины филиала
async function fetchCars(branch, token) {
  const response = await fetch(`${BASE_URL}/cars?per_page=100`, {
    headers: { 'X-Request-Token': token }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch cars: ${response.status}`);
  }

  const data = await response.json();
  return data.data || [];
}

// Upsert цен машины
async function upsertCarPrices(sql, carId, carData) {
  const pricePeriods = carData.price_periods || [];
  const seasons = carData.seasons || [];
  const prices = carData.prices || [];

  if (prices.length === 0) {
    return { inserted: 0, updated: 0 };
  }

  let inserted = 0;
  let updated = 0;

  for (const priceRecord of prices) {
    const seasonId = priceRecord.season_id;
    const values = priceRecord.values || [];
    const rentprogPriceId = String(priceRecord.id);

    // Пропустить если все цены = 0
    if (values.every(v => v === 0)) {
      continue;
    }

    // Структура price_values
    const priceData = {
      periods: pricePeriods,
      values: values,
      items: pricePeriods.map((period, idx) => ({
        period: period,
        price_per_day: values[idx] || 0,
        price_gel: values[idx] || 0,
        price_usd: Math.round((values[idx] / 2.7) * 100) / 100,
        currency: 'GEL'
      })),
      currency: 'GEL',
      exchange_rate: 2.7
    };

    // Добавить сезон
    const season = seasons.find(s => s.id === seasonId);
    if (season) {
      priceData.season = {
        start_date: season.start_date,
        end_date: season.end_date
      };
    }

    // Проверить существование
    const existing = await sql`
      SELECT id FROM car_prices 
      WHERE car_id = ${carId} AND season_id = ${seasonId}
      LIMIT 1
    `;

    if (existing.length > 0) {
      // UPDATE
      await sql`
        UPDATE car_prices 
        SET price_values = ${JSON.stringify(priceData)},
            rentprog_price_id = ${rentprogPriceId},
            currency = 'GEL',
            exchange_rate = 2.7,
            updated_at = NOW()
        WHERE id = ${existing[0].id}
      `;
      updated++;
    } else {
      // INSERT
      await sql`
        INSERT INTO car_prices (car_id, season_id, rentprog_price_id, price_values, currency, exchange_rate, created_at, updated_at)
        VALUES (${carId}, ${seasonId}, ${rentprogPriceId}, ${JSON.stringify(priceData)}, 'GEL', 2.7, NOW(), NOW())
      `;
      inserted++;
    }
  }

  return { inserted, updated };
}

// Основная функция синхронизации
export async function syncPricesForBranch(branch) {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  try {
    console.log(`[${branch}] Getting token...`);
    const token = await getRequestToken(branch);

    console.log(`[${branch}] Fetching cars...`);
    const rentprogCars = await fetchCars(branch, token);

    console.log(`[${branch}] Found ${rentprogCars.length} cars`);

    // Получить ID филиала
    const branchResult = await sql`SELECT id FROM branches WHERE code = ${branch}`;
    if (branchResult.length === 0) {
      throw new Error(`Branch ${branch} not found in database`);
    }
    const branchId = branchResult[0].id;

    // Обработать каждую машину
    for (const rentprogCar of rentprogCars) {
      try {
        // Найти машину в нашей БД
        const ourCar = await sql`
          SELECT id FROM cars 
          WHERE branch_id = ${branchId} 
            AND (plate = ${rentprogCar.number} OR code = ${rentprogCar.code})
          LIMIT 1
        `;

        if (ourCar.length === 0) {
          console.log(`[${branch}] Car not found: ${rentprogCar.number}`);
          skipped++;
          continue;
        }

        // Upsert цены
        const result = await upsertCarPrices(sql, ourCar[0].id, rentprogCar);
        inserted += result.inserted;
        updated += result.updated;

      } catch (error) {
        console.error(`[${branch}] Error for car ${rentprogCar.number}:`, error.message);
        errors++;
      }
    }

    console.log(`[${branch}] Sync completed: +${inserted} ~${updated} -${skipped} !${errors}`);

    return { inserted, updated, skipped, errors };

  } catch (error) {
    console.error(`[${branch}] Fatal error:`, error);
    throw error;
  } finally {
    await sql.end();
  }
}
```

---

## Тестирование

### Локальный тест:

```bash
# Запустить Jarvis API
npm run dev

# Вызвать endpoint
curl http://localhost:3000/sync-prices/tbilisi
```

### Из n8n:

```
HTTP Request Node:
  Method: GET
  URL: http://46.224.17.15:3000/sync-prices/{{ $json.branch }}
  Timeout: 300000 (5 минут)
```

---

## Интеграция в Jarvis API

### Вариант 1: Прямой импорт модуля

```typescript
import { syncPricesForBranch } from '../setup/sync_prices_module.mjs';

app.get('/sync-prices/:branch', async (req, res) => {
  const result = await syncPricesForBranch(req.params.branch);
  res.json({ ok: true, ...result });
});
```

### Вариант 2: Вызов через child_process

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
const execPromise = promisify(exec);

app.get('/sync-prices/:branch', async (req, res) => {
  try {
    const { stdout } = await execPromise(
      `node setup/fill_car_prices.mjs ${req.params.branch}`
    );
    
    // Парсить stdout для статистики
    res.json({ ok: true, output: stdout });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
```

---

## Рекомендация

Используйте **Вариант 1** - создайте переиспользуемый модуль `sync_prices_module.mjs` который можно вызывать:
- Из командной строки: `node setup/fill_car_prices.mjs tbilisi`
- Из API: `import { syncPricesForBranch } from '...'`
- Из других модулей

---

## Дополнительно: Webhook обработчик

Если RentProg отправляет события изменения цен:

```typescript
app.post('/webhook/price-updated', async (req, res) => {
  const { branch, car_id } = req.body;

  // Быстрый ACK
  res.json({ ok: true });

  // Асинхронно обновить цены конкретной машины
  try {
    const token = await getRequestToken(branch);
    const carData = await fetch(
      `${BASE_URL}/cars/${car_id}`,
      { headers: { 'X-Request-Token': token }}
    ).then(r => r.json());

    await upsertCarPrices(ourCarId, carData);
    
    console.log(`Price updated for car ${car_id}`);
  } catch (error) {
    console.error('Price update error:', error);
  }
});
```

---

**Статус:** Готов к внедрению  
**Приоритет:** Высокий  
**Время внедрения:** 1-2 часа

