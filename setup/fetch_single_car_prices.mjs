#!/usr/bin/env node
/**
 * Скрипт для получения цен одного автомобиля через /car_data_with_bookings
 * Использует консервативные лимиты RentProg API (1.5 сек между запросами)
 */

import postgres from 'postgres';
import fetch from 'node-fetch';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

// Токены филиалов (из ENV или дефолтные)
const BRANCH_TOKENS = JSON.parse(process.env.RENTPROG_BRANCH_KEYS || '{}');

// Консервативная задержка (оставляем запас для других сервисов)
const DELAY_MS = 1500; // 1.5 сек между запросами

const BASE_URL = 'https://rentprog.net/api/v1/public';
const BRANCHES = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getRequestToken(branch) {
  const companyToken = BRANCH_TOKENS[branch];
  if (!companyToken) {
    throw new Error(`Нет токена для филиала ${branch}`);
  }
  
  console.log(`  🔑 Получение токена для ${branch}...`);
  const response = await fetch(`${BASE_URL}/get_token?company_token=${companyToken}`);
  
  if (!response.ok) {
    throw new Error(`Ошибка получения токена: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.token;
}

async function fetchCarData(branch, token, carId) {
  console.log(`  📡 Запрос данных автомобиля ${carId} в филиале ${branch}...`);
  
  const response = await fetch(
    `${BASE_URL}/car_data_with_bookings?car_id=${carId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  if (!response.ok) {
    if (response.status === 404) {
      console.log(`  ⚠️  Авто не найдено в филиале ${branch}`);
      return null;
    }
    throw new Error(`Ошибка запроса: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data;
}

async function upsertCarPrices(carUuid, carData) {
  if (!carData.seasons || carData.seasons.length === 0) {
    console.log(`  ℹ️  Нет сезонов у автомобиля`);
    return { inserted: 0, updated: 0 };
  }
  
  let inserted = 0;
  let updated = 0;
  
  for (const season of carData.seasons) {
    if (!season.price_values || Object.keys(season.price_values).length === 0) {
      continue;
    }
    
    // Проверяем существование записи
    const existing = await sql`
      SELECT id FROM car_prices
      WHERE car_id = ${carUuid} 
        AND season_id = ${season.id}
    `;
    
    const priceData = {
      car_id: carUuid,
      rentprog_price_id: season.id?.toString(),
      season_id: season.id,
      season_start_date: season.start_date ? new Date(season.start_date) : null,
      season_end_date: season.end_date ? new Date(season.end_date) : null,
      season_name: season.name,
      price_values: JSON.stringify(season.price_values),
      active: true,
      updated_at: new Date()
    };
    
    if (existing.length > 0) {
      // Обновление
      await sql`
        UPDATE car_prices
        SET 
          price_values = ${priceData.price_values},
          season_start_date = ${priceData.season_start_date},
          season_end_date = ${priceData.season_end_date},
          season_name = ${priceData.season_name},
          updated_at = ${priceData.updated_at}
        WHERE id = ${existing[0].id}
      `;
      updated++;
    } else {
      // Вставка
      await sql`
        INSERT INTO car_prices ${sql(priceData)}
      `;
      inserted++;
    }
  }
  
  console.log(`  ✅ Сохранено: ${inserted} новых, ${updated} обновлено`);
  return { inserted, updated };
}

async function findCarWithoutPrices() {
  console.log('🔍 Поиск автомобиля без цен...\n');
  
  // Находим авто, у которого либо нет записей в car_prices, либо их мало
  const cars = await sql`
    SELECT 
      c.id as car_uuid,
      c.branch_id,
      b.code as branch_code,
      er.external_id as rentprog_car_id,
      COUNT(cp.id) as prices_count
    FROM cars c
    JOIN branches b ON b.id = c.branch_id
    JOIN external_refs er ON er.entity_id = c.id 
      AND er.entity_type = 'car' 
      AND er.system = 'rentprog'
    LEFT JOIN car_prices cp ON cp.car_id = c.id
    GROUP BY c.id, c.branch_id, b.code, er.external_id
    HAVING COUNT(cp.id) = 0
    ORDER BY c.created_at DESC
    LIMIT 1
  `;
  
  if (cars.length === 0) {
    console.log('❌ Не найдено автомобилей без цен');
    return null;
  }
  
  const car = cars[0];
  console.log(`📌 Найдено авто:`);
  console.log(`   UUID: ${car.car_uuid}`);
  console.log(`   RentProg ID: ${car.rentprog_car_id}`);
  console.log(`   Филиал: ${car.branch_code}`);
  console.log(`   Цен в БД: ${car.prices_count}\n`);
  
  return car;
}

async function fetchAndSaveCarPrices(car) {
  const primaryBranch = car.branch_code;
  const carId = car.rentprog_car_id;
  
  console.log(`🚀 Получение данных автомобиля ${carId}...\n`);
  
  // Пробуем сначала в основном филиале
  try {
    const token = await getRequestToken(primaryBranch);
    await sleep(DELAY_MS); // Задержка после получения токена
    
    const carData = await fetchCarData(primaryBranch, token, carId);
    
    if (carData) {
      console.log(`  ✅ Данные найдены в основном филиале ${primaryBranch}`);
      console.log(`  📊 Сезонов: ${carData.seasons?.length || 0}`);
      
      if (carData.seasons && carData.seasons.length > 0) {
        await upsertCarPrices(car.car_uuid, carData);
        return { success: true, branch: primaryBranch };
      } else {
        console.log(`  ⚠️  Нет сезонов у автомобиля в ${primaryBranch}`);
      }
    }
  } catch (error) {
    console.log(`  ❌ Ошибка в филиале ${primaryBranch}: ${error.message}`);
  }
  
  // Если не нашли в основном филиале, пробуем остальные
  console.log(`\n🔄 Поиск в других филиалах...`);
  
  for (const branch of BRANCHES) {
    if (branch === primaryBranch) continue; // Уже пробовали
    
    try {
      await sleep(DELAY_MS); // Задержка между филиалами
      
      const token = await getRequestToken(branch);
      await sleep(DELAY_MS); // Задержка после получения токена
      
      const carData = await fetchCarData(branch, token, carId);
      
      if (carData && carData.seasons && carData.seasons.length > 0) {
        console.log(`  ✅ Данные найдены в ${branch}!`);
        console.log(`  📊 Сезонов: ${carData.seasons.length}`);
        
        await upsertCarPrices(car.car_uuid, carData);
        return { success: true, branch };
      }
    } catch (error) {
      console.log(`  ❌ Ошибка в филиале ${branch}: ${error.message}`);
    }
  }
  
  console.log(`\n❌ Не удалось найти данные автомобиля ни в одном филиале`);
  return { success: false };
}

async function main() {
  try {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   Получение цен одного автомобиля через RentProg API    ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    
    // 1. Находим авто без цен
    const car = await findCarWithoutPrices();
    if (!car) {
      process.exit(0);
    }
    
    // 2. Получаем и сохраняем данные
    const result = await fetchAndSaveCarPrices(car);
    
    if (result.success) {
      console.log(`\n✅ Успешно! Данные получены из филиала ${result.branch}`);
    } else {
      console.log(`\n⚠️  Не удалось получить данные`);
    }
    
    console.log('\n✨ Готово!');
    
  } catch (error) {
    console.error('\n❌ Критическая ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

