import { Client } from 'pg';

const BASE_URL = 'https://rentprog.net/api/v1/public';
const REQUEST_DELAY_MS = 3000; // 3 сек = 20 запросов/мин (консервативно для избежания Rate limit)

// Hardcoded company tokens per branch
const BRANCH_TOKENS = {
  tbilisi: '91b83b93963633649f29a04b612bab3f9fbb0471b5928622',
  batumi: '7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d',
  kutaisi: '5599ebb7b94827fdfd49ca3a5b7e259cfa99d8ea78edeb50',
  'service-center': '5y4j4gcs75o9n5s1e2vrxx4a'
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getRequestToken(companyToken) {
  const res = await fetch(`${BASE_URL}/get_token?company_token=${companyToken}`, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`get_token HTTP ${res.status}`);
  }
  const json = await res.json();
  const token = json?.token;
  if (!token) {
    throw new Error('Empty request token');
  }
  return token;
}

async function fetchCarDataWithBookings(requestToken, carId) {
  const url = `${BASE_URL}/car_data_with_bookings?car_id=${carId}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${requestToken}` } });
  
  if (res.status === 401 || res.status === 403) {
    const err = new Error('Unauthorized');
    err.code = 'UNAUTH';
    throw err;
  }
  
  if (res.status === 404) {
    // Машина не найдена - это нормально, пропускаем
    return null;
  }
  
  if (!res.ok) {
    throw new Error(`car_data_with_bookings HTTP ${res.status}`);
  }
  
  return await res.json();
}

async function upsertCarPrices(client, carId, carData) {
  if (!carData) return { inserted: 0, updated: 0 };
  
  // Извлечь данные о ценах
  const pricePeriods = carData.price_periods || [];
  const seasons = carData.seasons || [];
  const prices = carData.prices || [];
  
  // Проверить есть ли prices (массив объектов с values и season_id)
  if (prices.length === 0) {
    return { inserted: 0, updated: 0 };
  }
  
  let inserted = 0;
  let updated = 0;
  
  // Обработать каждую запись цен
  for (const priceRecord of prices) {
    const seasonId = priceRecord.season_id;
    const values = priceRecord.values || [];
    const rentprogPriceId = String(priceRecord.id);
    
    // Пропустить если все цены нулевые (не заполнены)
    if (values.every(v => v === 0)) {
      continue;
    }
    
    // Создать структурированный объект с периодами и ценами
    const priceData = {
      periods: pricePeriods,
      values: values,
      items: pricePeriods.map((period, idx) => ({
        period: period,
        price_per_day: values[idx] || 0
      }))
    };
    
    // Найти сезон
    const season = seasons.find(s => s.id === seasonId);
    if (season) {
      priceData.season = {
        start_date: season.start_date,
        end_date: season.end_date
      };
    }
    
    // Проверить существует ли запись (используем IS NOT DISTINCT FROM для NULL)
    const existing = await client.query(
      `SELECT id FROM car_prices 
       WHERE car_id = $1 AND season_id IS NOT DISTINCT FROM $2 
       LIMIT 1`,
      [carId, seasonId]
    );
    
    // Извлечь данные сезона
    const seasonName = priceData.season?.name || null;
    const seasonStartDate = priceData.season?.start_date || null;
    const seasonEndDate = priceData.season?.end_date || null;
    
    if (existing.rows.length > 0) {
      // Обновить
      await client.query(
        `UPDATE car_prices 
         SET price_values = $1,
             rentprog_price_id = $2,
             season_name = $3,
             season_start_date = $4,
             season_end_date = $5,
             active = TRUE,
             updated_at = NOW()
         WHERE id = $6`,
        [JSON.stringify(priceData), rentprogPriceId, seasonName, seasonStartDate, seasonEndDate, existing.rows[0].id]
      );
      updated++;
    } else {
      // Вставить
      await client.query(
        `INSERT INTO car_prices (car_id, season_id, rentprog_price_id, price_values, season_name, season_start_date, season_end_date, active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW(), NOW())`,
        [carId, seasonId, rentprogPriceId, JSON.stringify(priceData), seasonName, seasonStartDate, seasonEndDate]
      );
      inserted++;
    }
  }
  
  return { inserted, updated };
}

async function processBranch(client, branchCode, companyToken) {
  console.log(`\n===== ${branchCode.toUpperCase()} =====`);
  
  let token = await getRequestToken(companyToken);
  await sleep(REQUEST_DELAY_MS); // Задержка после получения токена
  console.log('✓ token received');
  
  // Получить все машины этого филиала через external_refs
  const { rows: cars } = await client.query(
    `SELECT c.id, er.external_id AS rentprog_id, c.model, c.plate
     FROM cars c
     JOIN branches b ON b.id = c.branch_id
     JOIN external_refs er ON er.entity_id = c.id
     WHERE b.code = $1 
       AND er.system = 'rentprog'
       AND er.entity_type = 'car'
     ORDER BY c.model`,
    [branchCode]
  );
  
  console.log(`Found ${cars.length} cars in ${branchCode}`);
  
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  
  for (const car of cars) {
    try {
      let carData;
      try {
        carData = await fetchCarDataWithBookings(token, car.rentprog_id);
      } catch (e) {
        if (e.code === 'UNAUTH') {
          console.log('↻ token expired, refreshing...');
          token = await getRequestToken(companyToken);
          carData = await fetchCarDataWithBookings(token, car.rentprog_id);
        } else {
          throw e;
        }
      }
      
      if (!carData) {
        console.log(`  ⊘ ${car.model} (${car.plate}) - not found in RentProg`);
        totalSkipped++;
        continue;
      }
      
      const { inserted, updated } = await upsertCarPrices(client, car.id, carData);
      totalInserted += inserted;
      totalUpdated += updated;
      
      if (inserted > 0 || updated > 0) {
        console.log(`  ✓ ${car.model} (${car.plate}) - ${inserted} inserted, ${updated} updated`);
      } else {
        console.log(`  ⊘ ${car.model} (${car.plate}) - no prices`);
        totalSkipped++;
      }
      
      await sleep(REQUEST_DELAY_MS);
      
    } catch (error) {
      console.log(`  ✗ ${car.model} (${car.plate}) - ERROR: ${error.message}`);
      totalErrors++;
    }
  }
  
  console.log(`\n${branchCode} summary:`);
  console.log(`  Inserted: ${totalInserted}`);
  console.log(`  Updated:  ${totalUpdated}`);
  console.log(`  Skipped:  ${totalSkipped}`);
  console.log(`  Errors:   ${totalErrors}`);
  
  return { inserted: totalInserted, updated: totalUpdated, skipped: totalSkipped, errors: totalErrors };
}

async function main() {
  const argBranch = process.argv[2];
  const branches = argBranch ? [argBranch] : ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
  
  const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
  const client = new Client({ 
    connectionString: CONNECTION_STRING, 
    ssl: { rejectUnauthorized: false } 
  });
  
  await client.connect();
  console.log('✓ Connected to database');
  
  let grandTotalInserted = 0;
  let grandTotalUpdated = 0;
  let grandTotalSkipped = 0;
  let grandTotalErrors = 0;
  
  for (const branch of branches) {
    const companyToken = BRANCH_TOKENS[branch];
    if (!companyToken) {
      console.log(`⚠️ skip ${branch}: no token`);
      continue;
    }
    
    const { inserted, updated, skipped, errors } = await processBranch(client, branch, companyToken);
    grandTotalInserted += inserted;
    grandTotalUpdated += updated;
    grandTotalSkipped += skipped;
    grandTotalErrors += errors;
    
    // Задержка между филиалами (кроме последнего)
    if (branch !== branches[branches.length - 1]) {
      await sleep(5000); // 5 сек между филиалами
    }
  }
  
  console.log('\n===== GRAND SUMMARY =====');
  console.log(`Inserted: ${grandTotalInserted}`);
  console.log(`Updated:  ${grandTotalUpdated}`);
  console.log(`Skipped:  ${grandTotalSkipped}`);
  console.log(`Errors:   ${grandTotalErrors}`);
  
  await client.end();
}

main().catch((e) => {
  console.error('❌ Error:', e.message);
  console.error(e.stack);
  process.exit(1);
});

