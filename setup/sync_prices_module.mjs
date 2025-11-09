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
    let seasonName = null;
    let seasonStartDate = null;
    let seasonEndDate = null;
    
    if (season) {
      priceData.season = {
        start_date: season.start_date,
        end_date: season.end_date,
        name: season.name
      };
      seasonName = season.name;
      seasonStartDate = season.start_date;
      seasonEndDate = season.end_date;
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
            season_name = ${seasonName},
            season_start_date = ${seasonStartDate},
            season_end_date = ${seasonEndDate},
            active = TRUE,
            updated_at = NOW()
        WHERE id = ${existing[0].id}
      `;
      updated++;
    } else {
      // INSERT
      try {
        await sql`
          INSERT INTO car_prices (
            car_id, season_id, rentprog_price_id, price_values,
            season_name, season_start_date, season_end_date,
            active, created_at, updated_at
          )
          VALUES (
            ${carId}, ${seasonId}, ${rentprogPriceId}, ${JSON.stringify(priceData)},
            ${seasonName}, ${seasonStartDate}, ${seasonEndDate},
            TRUE, NOW(), NOW()
          )
        `;
        inserted++;
      } catch (error) {
        // Ignore duplicate key errors
        if (!error.message.includes('duplicate key')) {
          throw error;
        }
      }
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
        // Найти машину в нашей БД (через external_refs)
        let ourCar = await sql`
          SELECT c.id 
          FROM cars c
          INNER JOIN external_refs er ON er.entity_id = c.id
          WHERE er.system = 'rentprog'
            AND er.entity_type = 'car'
            AND er.external_id = ${String(rentprogCar.id)}
            AND er.branch_code = ${branch}
          LIMIT 1
        `;
        
        // Fallback: поиск по номеру/коду
        if (ourCar.length === 0) {
          ourCar = await sql`
            SELECT id FROM cars 
            WHERE branch_id = ${branchId} 
              AND (plate = ${rentprogCar.number} OR data->>'code' = ${rentprogCar.code})
            LIMIT 1
          `;
        }

        if (ourCar.length === 0) {
          console.log(`[${branch}] Car not found: ${rentprogCar.number} (RP ID: ${rentprogCar.id})`);
          skipped++;
          continue;
        }

        // Upsert цены
        const result = await upsertCarPrices(sql, ourCar[0].id, rentprogCar);
        inserted += result.inserted;
        updated += result.updated;

        if (result.inserted === 0 && result.updated === 0) {
          skipped++;
        }

      } catch (error) {
        console.error(`[${branch}] Error for car ${rentprogCar.number || rentprogCar.id}:`, error.message);
        errors++;
      }
    }

    console.log(`[${branch}] Sync completed: +${inserted} ~${updated} -${skipped} !${errors}`);

    return { 
      ok: true,
      branch,
      inserted, 
      updated, 
      skipped, 
      errors 
    };

  } catch (error) {
    console.error(`[${branch}] Fatal error:`, error);
    return {
      ok: false,
      branch,
      error: error.message,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0
    };
  } finally {
    await sql.end();
  }
}

