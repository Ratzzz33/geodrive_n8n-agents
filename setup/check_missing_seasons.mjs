#!/usr/bin/env node
/**
 * Проверка сезонов, которые есть в БД, но отсутствуют в API
 */

import { Client } from 'pg';

const BASE_URL = 'https://rentprog.net/api/v1/public';
const PAGE_SIZE = 20;
const MAX_PAGES = 150;
const REQUEST_DELAY_MS = 1000;

const BRANCH_TOKENS = {
  tbilisi: '91b83b93963633649f29a04b612bab3f9fbb0471b5928622',
  batumi: '7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d',
  kutaisi: '5599ebb7b94827fdfd49ca3a5b7e259cfa99d8ea78edeb50',
  'service-center': '5y4j4gcs75o9n5s1e2vrxx4a'
};

const DEFAULT_ORDER = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getRequestToken(companyToken) {
  const res = await fetch(`${BASE_URL}/get_token?company_token=${companyToken}`, { method: 'GET' });
  if (!res.ok) throw new Error(`get_token HTTP ${res.status}`);
  const json = await res.json();
  return json?.token;
}

async function fetchCarsPage(requestToken, page) {
  const url = `${BASE_URL}/all_cars_full?limit=${PAGE_SIZE}&page=${page}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${requestToken}` } });
  if (!res.ok) throw new Error(`all_cars_full HTTP ${res.status}`);
  const json = await res.json();
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.cars)) return json.cars;
  return [];
}

async function fetchAllCars(branchCode, companyToken) {
  const requestToken = await getRequestToken(companyToken);
  await sleep(REQUEST_DELAY_MS);
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

async function main() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
  });

  try {
    await client.connect();
    console.log('🔍 Проверка сезонов цен\n');

    // Получаем сезоны из API
    const activeSeasonIds = new Set();
    for (const branchCode of DEFAULT_ORDER) {
      const companyToken = BRANCH_TOKENS[branchCode];
      if (!companyToken) continue;
      try {
        const cars = await fetchAllCars(branchCode, companyToken);
        cars.forEach(car => {
          if (car.prices && Array.isArray(car.prices)) {
            car.prices.forEach(price => {
              if (price && price.season_id) {
                activeSeasonIds.add(String(price.season_id));
              }
            });
          }
        });
      } catch (error) {
        console.error(`Ошибка для ${branchCode}: ${error.message}`);
      }
    }

    console.log(`📊 Активных сезонов в API: ${activeSeasonIds.size}`);

    // Получаем сезоны из БД
    const dbSeasons = await client.query(`
      SELECT DISTINCT season_id, COUNT(*) as count
      FROM car_prices
      WHERE active = TRUE
      GROUP BY season_id
      ORDER BY season_id
    `);

    console.log(`📊 Активных сезонов в БД: ${dbSeasons.rows.length}\n`);

    // Находим сезоны, которых нет в API
    const missingInApi = [];
    for (const row of dbSeasons.rows) {
      const seasonId = row.season_id;
      if (seasonId === null) {
        console.log(`⚠️  Найдены записи с season_id = NULL (${row.count} записей)`);
        continue;
      }
      const seasonIdStr = String(seasonId);
      if (!activeSeasonIds.has(seasonIdStr)) {
        missingInApi.push({ season_id: seasonId, count: row.count });
      }
    }

    if (missingInApi.length > 0) {
      console.log(`\n⚠️  Сезоны в БД, которых нет в API (${missingInApi.length}):`);
      missingInApi.forEach(s => {
        console.log(`   Сезон ${s.season_id}: ${s.count} записей`);
      });
    } else {
      console.log('\n✅ Все активные сезоны в БД присутствуют в API');
    }

    // Показываем все сезоны из БД
    console.log('\n📋 Все активные сезоны в БД:');
    dbSeasons.rows.forEach(row => {
      const inApi = row.season_id !== null && activeSeasonIds.has(String(row.season_id));
      console.log(`   ${row.season_id || 'NULL'}: ${row.count} записей ${inApi ? '✅' : '❌'}`);
    });

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await client.end();
  }
}

main().catch(console.error);

