#!/usr/bin/env node
/**
 * Деактивация старых сезонов цен, которых нет в RentProg API
 */

import { Client } from 'pg';

const BASE_URL = 'https://rentprog.net/api/v1/public';
const PAGE_SIZE = 20;
const MAX_PAGES = 150;
const REQUEST_DELAY_MS = 1000;

// Токены для каждого филиала
const BRANCH_TOKENS = {
  tbilisi: '91b83b93963633649f29a04b612bab3f9fbb0471b5928622',
  batumi: '7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d',
  kutaisi: '5599ebb7b94827fdfd49ca3a5b7e259cfa99d8ea78edeb50',
  'service-center': '5y4j4gcs75o9n5s1e2vrxx4a'
};

const DEFAULT_ORDER = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Получение токена запроса
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

// Получение машин с пагинацией
async function fetchCarsPage(requestToken, page) {
  const url = `${BASE_URL}/all_cars_full?limit=${PAGE_SIZE}&page=${page}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${requestToken}` } });
  if (res.status === 401 || res.status === 403) {
    const err = new Error('Unauthorized');
    err.code = 'UNAUTH';
    throw err;
  }
  if (!res.ok) {
    throw new Error(`all_cars_full HTTP ${res.status}`);
  }
  const json = await res.json();
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.cars)) return json.cars;
  return [];
}

// Получение всех машин из филиала
async function fetchAllCars(branchCode, companyToken) {
  let requestToken;
  try {
    requestToken = await getRequestToken(companyToken);
    await sleep(REQUEST_DELAY_MS);
  } catch (error) {
    throw new Error(`Ошибка получения токена для ${branchCode}: ${error.message}`);
  }

  const allCars = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= MAX_PAGES) {
    const carsPage = await fetchCarsPage(requestToken, page);
    allCars.push(...carsPage);
    hasMore = carsPage.length === PAGE_SIZE;
    page++;
    if (hasMore) await sleep(REQUEST_DELAY_MS);
  }

  return allCars;
}

// Главная функция
async function main() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
  });

  try {
    await client.connect();
    console.log('🧹 Деактивация старых сезонов цен');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📅 Дата: ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })}`);
    console.log('\n');

    // 1. Получаем все машины с ценами из API
    console.log('📡 Получение машин с ценами из RentProg API...\n');
    const carPricesMap = new Map(); // Map<rentprog_id, Set<season_id>>

    for (const branchCode of DEFAULT_ORDER) {
      console.log(`   📡 ${branchCode}...`);
      const companyToken = BRANCH_TOKENS[branchCode];
      if (!companyToken) {
        console.error(`   ❌ Токен для филиала ${branchCode} не найден. Пропускаю.`);
        continue;
      }

      try {
        const cars = await fetchAllCars(branchCode, companyToken);
        console.log(`   ✅ Получено машин: ${cars.length}`);

        // Собираем сезоны для каждой машины
        cars.forEach(car => {
          if (car && car.id) {
            const rentprogId = String(car.id).trim();
            const seasonSet = new Set();
            
            if (car.prices && Array.isArray(car.prices)) {
              car.prices.forEach(price => {
                if (price && price.season_id) {
                  seasonSet.add(String(price.season_id));
                }
              });
            }
            
            carPricesMap.set(rentprogId, seasonSet);
          }
        });
      } catch (error) {
        console.error(`   ❌ Ошибка получения машин из ${branchCode}: ${error.message}`);
      }
      console.log('');
    }

    console.log(`📊 Получено машин из API: ${carPricesMap.size}\n`);

    // 2. Получаем все активные цены из БД с привязкой к машинам
    console.log('📥 Получение активных цен из БД...');
    const dbPrices = await client.query(`
      SELECT 
        cp.id,
        cp.car_id,
        cp.season_id,
        er.external_id::text AS rentprog_id
      FROM car_prices cp
      JOIN cars c ON c.id = cp.car_id
      JOIN external_refs er ON er.entity_id = c.id
      WHERE cp.active = TRUE
        AND er.system = 'rentprog'
        AND er.entity_type = 'car'
    `);

    console.log(`   ✅ Найдено активных цен в БД: ${dbPrices.rows.length}\n`);

    // 3. Находим цены, которые нужно деактивировать
    const pricesToDeactivate = [];
    let statsBySeason = new Map();

    for (const dbPrice of dbPrices.rows) {
      const rentprogId = String(dbPrice.rentprog_id).trim();
      const seasonId = dbPrice.season_id;

      // Пропускаем NULL
      if (seasonId === null) {
        pricesToDeactivate.push(dbPrice.id);
        continue;
      }

      const seasonIdStr = String(seasonId);
      const apiSeasons = carPricesMap.get(rentprogId);

      // Если машины нет в API или у нее нет этого сезона - деактивируем
      if (!apiSeasons || !apiSeasons.has(seasonIdStr)) {
        pricesToDeactivate.push(dbPrice.id);
        
        // Статистика по сезонам
        if (!statsBySeason.has(seasonIdStr)) {
          statsBySeason.set(seasonIdStr, 0);
        }
        statsBySeason.set(seasonIdStr, statsBySeason.get(seasonIdStr) + 1);
      }
    }

    if (pricesToDeactivate.length === 0) {
      console.log('\n✅ Все активные цены в БД присутствуют в API. Деактивация не требуется.');
      return;
    }

    console.log(`\n⚠️  Найдено цен для деактивации: ${pricesToDeactivate.length}`);
    if (statsBySeason.size > 0) {
      console.log(`   По сезонам:`);
      const sortedSeasons = Array.from(statsBySeason.entries()).sort((a, b) => Number(a[0]) - Number(b[0]));
      sortedSeasons.forEach(([seasonId, count]) => {
        console.log(`      Сезон ${seasonId}: ${count} записей`);
      });
    }
    console.log('');

    // 4. Деактивируем старые цены (батчами по 1000)
    console.log('🔄 Деактивация старых цен...');
    
    const BATCH_SIZE = 1000;
    let totalDeactivated = 0;

    for (let i = 0; i < pricesToDeactivate.length; i += BATCH_SIZE) {
      const batch = pricesToDeactivate.slice(i, i + BATCH_SIZE);
      const result = await client.query(`
        UPDATE car_prices
        SET active = FALSE,
            updated_at = NOW()
        WHERE id = ANY($1::uuid[])
          AND active = TRUE
      `, [batch]);
      totalDeactivated += result.rowCount;
    }

    console.log(`   ✅ Деактивировано записей: ${totalDeactivated}\n`);

    // 5. Статистика по машинам
    const carsStats = await client.query(`
      SELECT 
        c.plate,
        c.model,
        COUNT(cp.id) as deactivated_count
      FROM car_prices cp
      JOIN cars c ON c.id = cp.car_id
      WHERE cp.id = ANY($1::uuid[])
        AND cp.active = FALSE
      GROUP BY c.id, c.plate, c.model
      ORDER BY deactivated_count DESC
      LIMIT 10
    `, [pricesToDeactivate]);

    if (carsStats.rows.length > 0) {
      console.log('📊 Топ-10 машин по количеству деактивированных сезонов:');
      carsStats.rows.forEach((row, idx) => {
        console.log(`   ${idx + 1}. ${row.plate} (${row.model}): ${row.deactivated_count} сезонов`);
      });
      console.log('');
    }

    // Итоговая статистика
    console.log('━'.repeat(50));
    console.log('📊 ИТОГОВАЯ СТАТИСТИКА');
    console.log('━'.repeat(50));
    console.log(`   Машин в API: ${carPricesMap.size}`);
    console.log(`   Активных цен в БД (до): ${dbPrices.rows.length}`);
    console.log(`   Деактивировано цен: ${totalDeactivated}`);
    console.log(`   Уникальных сезонов затронуто: ${statsBySeason.size}`);
    console.log('━'.repeat(50));
    console.log('\n✅ Готово! Старые цены деактивированы.');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

main().catch(console.error);

