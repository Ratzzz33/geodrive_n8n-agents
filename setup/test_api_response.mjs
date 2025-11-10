#!/usr/bin/env node
/**
 * Проверка полного ответа API для машин с ценами season_id = null
 */

const BASE_URL = 'https://rentprog.net/api/v1/public';

const BRANCH_TOKENS = {
  batumi: '7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d',
  'service-center': '5y4j4gcs75o9n5s1e2vrxx4a'
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getRequestToken(companyToken) {
  const res = await fetch(`${BASE_URL}/get_token?company_token=${companyToken}`, { method: 'GET' });
  if (!res.ok) throw new Error(`get_token HTTP ${res.status}`);
  const json = await res.json();
  return json?.token;
}

async function main() {
  const platesToCheck = ['EP962EP', 'QZ101QQ', 'TS078TT', 'FK256FF'];
  
  console.log('🔍 Проверка полного ответа API\n');
  console.log('Endpoint: /all_cars_full');
  console.log('━'.repeat(50));
  console.log('');

  // Проверяем batumi (первые 3 машины)
  console.log('📡 Получение машин из batumi...');
  const batumiToken = await getRequestToken(BRANCH_TOKENS.batumi);
  await sleep(1000);
  
  const batumiUrl = `${BASE_URL}/all_cars_full?limit=100&page=1`;
  const batumiRes = await fetch(batumiUrl, { 
    headers: { Authorization: `Bearer ${batumiToken}` } 
  });
  
  if (!batumiRes.ok) {
    console.error(`❌ Ошибка: ${batumiRes.status} ${batumiRes.statusText}`);
    return;
  }
  
  const batumiData = await batumiRes.json();
  const batumiCars = Array.isArray(batumiData) ? batumiData : (batumiData?.data || batumiData?.cars || []);
  
  console.log(`   ✅ Получено машин: ${batumiCars.length}\n`);
  
  for (const plate of ['EP962EP', 'QZ101QQ', 'TS078TT']) {
    const car = batumiCars.find(c => c && c.number && String(c.number).trim().toUpperCase() === plate.toUpperCase());
    
    if (car) {
      console.log(`🚗 ${plate} (${car.car_name || 'N/A'})`);
      console.log(`   RentProg ID: ${car.id}`);
      console.log(`   Цены в ответе API:`);
      console.log(`   prices: ${JSON.stringify(car.prices, null, 2)}`);
      console.log('');
    }
  }

  // Проверяем service-center (FK256FF)
  console.log('📡 Получение машин из service-center...');
  const scToken = await getRequestToken(BRANCH_TOKENS['service-center']);
  await sleep(1000);
  
  const scUrl = `${BASE_URL}/all_cars_full?limit=100&page=1`;
  const scRes = await fetch(scUrl, { 
    headers: { Authorization: `Bearer ${scToken}` } 
  });
  
  if (!scRes.ok) {
    console.error(`❌ Ошибка: ${scRes.status} ${scRes.statusText}`);
    return;
  }
  
  const scData = await scRes.json();
  const scCars = Array.isArray(scData) ? scData : (scData?.data || scData?.cars || []);
  
  console.log(`   ✅ Получено машин: ${scCars.length}\n`);
  
  const car = scCars.find(c => c && c.number && String(c.number).trim().toUpperCase() === 'FK256FF');
  
  if (car) {
    console.log(`🚗 FK256FF (${car.car_name || 'N/A'})`);
    console.log(`   RentProg ID: ${car.id}`);
    console.log(`   Цены в ответе API:`);
    console.log(`   prices: ${JSON.stringify(car.prices, null, 2)}`);
    console.log('');
  }

  console.log('━'.repeat(50));
  console.log('✅ Проверка завершена');
}

main().catch(console.error);

