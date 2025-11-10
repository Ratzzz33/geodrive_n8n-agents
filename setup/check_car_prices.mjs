#!/usr/bin/env node
/**
 * Проверка цен для конкретных машин в RentProg API
 */

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
  const platesToCheck = ['EP962EP', 'QZ101QQ', 'TS078TT', 'FK256FF'];
  
  console.log('🔍 Проверка цен для машин в RentProg API\n');
  console.log('Проверяемые машины:', platesToCheck.join(', '));
  console.log('━'.repeat(50));
  console.log('');

  for (const branchCode of DEFAULT_ORDER) {
    const companyToken = BRANCH_TOKENS[branchCode];
    if (!companyToken) continue;

    try {
      console.log(`📡 Получение машин из ${branchCode}...`);
      const cars = await fetchAllCars(branchCode, companyToken);
      console.log(`   ✅ Получено машин: ${cars.length}\n`);

      // Ищем нужные машины
      for (const plate of platesToCheck) {
        const car = cars.find(c => c && c.number && String(c.number).trim().toUpperCase() === plate.toUpperCase());
        
        if (car) {
          console.log(`🚗 ${plate} (${car.car_name || 'N/A'})`);
          console.log(`   RentProg ID: ${car.id}`);
          console.log(`   Филиал: ${branchCode}`);
          console.log(`   Цены в API:`);
          
          if (car.prices && Array.isArray(car.prices) && car.prices.length > 0) {
            console.log(`      ✅ Найдено сезонов: ${car.prices.length}`);
            car.prices.forEach((price, idx) => {
              console.log(`      ${idx + 1}. Сезон ${price.season_id}: ${price.values ? price.values.length : 0} значений`);
              if (price.values && price.values.length > 0) {
                console.log(`         Значения: ${JSON.stringify(price.values.slice(0, 3))}${price.values.length > 3 ? '...' : ''}`);
              }
            });
          } else {
            console.log(`      ❌ Цен нет (prices: ${JSON.stringify(car.prices)})`);
          }
          console.log('');
        }
      }
    } catch (error) {
      console.error(`   ❌ Ошибка для ${branchCode}: ${error.message}\n`);
    }
  }

  console.log('━'.repeat(50));
  console.log('✅ Проверка завершена');
}

main().catch(console.error);

