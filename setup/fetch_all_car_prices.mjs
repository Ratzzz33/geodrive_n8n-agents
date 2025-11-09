#!/usr/bin/env node
/**
 * Массовая загрузка цен для всех автомобилей без цен
 * Использует консервативные лимиты RentProg API (1.5 сек между GET запросами)
 */

import postgres from 'postgres';
import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Загрузка .env файла
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');

try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#][^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  });
  console.log('✅ .env файл загружен\n');
} catch (error) {
  console.log('⚠️  .env файл не найден, используем переменные окружения\n');
}

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

// Токены филиалов
let BRANCH_TOKENS = {};
try {
  BRANCH_TOKENS = JSON.parse(process.env.RENTPROG_BRANCH_KEYS || '{}');
  console.log(`📦 Загружено токенов: ${Object.keys(BRANCH_TOKENS).length}\n`);
} catch (error) {
  console.error('❌ Ошибка парсинга RENTPROG_BRANCH_KEYS:', error.message);
  process.exit(1);
}

// Консервативные задержки (33% от лимита RentProg)
const DELAY_BETWEEN_REQUESTS = 1500; // 1.5 сек = 40 запросов/мин (лимит: 120/мин)
const DELAY_BETWEEN_CARS = 3000;     // 3 сек между машинами
const BASE_URL = 'https://rentprog.net/api/v1/public';
const BRANCHES = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];

// Статистика
const stats = {
  total: 0,
  processed: 0,
  withPrices: 0,
  withoutPrices: 0,
  errors: 0,
  saved: 0
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getRequestToken(branch) {
  const companyToken = BRANCH_TOKENS[branch];
  if (!companyToken) {
    throw new Error(`Нет токена для филиала ${branch}`);
  }
  
  const response = await fetch(`${BASE_URL}/get_token?company_token=${companyToken}`);
  
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Rate limit exceeded');
    }
    throw new Error(`Ошибка получения токена: ${response.status}`);
  }
  
  const data = await response.json();
  return data.token;
}

async function fetchCarData(branch, token, carId) {
  const response = await fetch(
    `${BASE_URL}/car_data_with_bookings?car_id=${carId}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  
  if (!response.ok) {
    if (response.status === 404) return null;
    if (response.status === 429) {
      throw new Error('Rate limit exceeded');
    }
    throw new Error(`Ошибка запроса: ${response.status}`);
  }
  
  return await response.json();
}

async function upsertCarPrices(carUuid, carData) {
  if (!carData.seasons || carData.seasons.length === 0) {
    return { inserted: 0, updated: 0 };
  }
  
  let inserted = 0;
  let updated = 0;
  
  for (const season of carData.seasons) {
    if (!season.price_values || Object.keys(season.price_values).length === 0) {
      continue;
    }
    
    const existing = await sql`
      SELECT id FROM car_prices
      WHERE car_id = ${carUuid} AND season_id = ${season.id}
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
      await sql`INSERT INTO car_prices ${sql(priceData)}`;
      inserted++;
    }
  }
  
  return { inserted, updated };
}

async function saveCheckResult(car, hasPrices) {
  try {
    await sql`
      INSERT INTO car_price_checks 
        (branch, car_id, rentprog_car_id, checked_at, resolved)
      VALUES 
        (${car.branch_code}, ${car.car_uuid}, ${car.rentprog_car_id}, NOW(), FALSE)
    `;
  } catch (error) {
    // Игнорируем ошибки дубликатов
  }
}

async function getCarsWithoutPrices(limit = 10) {
  const cars = await sql`
    SELECT 
      c.id as car_uuid,
      b.code as branch_code,
      er.external_id as rentprog_car_id,
      COUNT(cp.id) as prices_count
    FROM cars c
    JOIN branches b ON b.id = c.branch_id
    JOIN external_refs er ON er.entity_id = c.id 
      AND er.entity_type = 'car' 
      AND er.system = 'rentprog'
    LEFT JOIN car_prices cp ON cp.car_id = c.id
    GROUP BY c.id, b.code, er.external_id
    HAVING COUNT(cp.id) < 3
    ORDER BY RANDOM()
    LIMIT ${limit}
  `;
  
  return cars;
}

async function processCar(car, carNumber, totalCars) {
  console.log(`\n[${ carNumber}/${totalCars}] 🚗 Авто: ${car.rentprog_car_id} (${car.branch_code}), цен в БД: ${car.prices_count}`);
  
  stats.processed++;
  
  const primaryBranch = car.branch_code;
  let foundData = false;
  let savedCount = 0;
  
  // Пробуем основной филиал
  try {
    const token = await getRequestToken(primaryBranch);
    await sleep(DELAY_BETWEEN_REQUESTS);
    
    const carData = await fetchCarData(primaryBranch, token, car.rentprog_car_id);
    
    if (carData && carData.seasons && carData.seasons.length > 0) {
      const result = await upsertCarPrices(car.car_uuid, carData);
      savedCount = result.inserted + result.updated;
      
      if (savedCount > 0) {
        console.log(`   ✅ Сохранено: ${result.inserted} новых, ${result.updated} обновлено`);
        stats.withPrices++;
        stats.saved += savedCount;
        foundData = true;
      } else {
        console.log(`   ⚠️  Сезонов: ${carData.seasons.length}, но price_values пусты`);
        stats.withoutPrices++;
      }
      
      await saveCheckResult(car, savedCount > 0);
      return;
    }
  } catch (error) {
    if (error.message.includes('Rate limit')) {
      console.log(`   ⏸️  Rate limit! Пауза 60 сек...`);
      await sleep(60000);
      return; // Пропускаем эту машину
    }
    console.log(`   ❌ Ошибка в ${primaryBranch}: ${error.message}`);
  }
  
  // Пробуем другие филиалы
  for (const branch of BRANCHES) {
    if (branch === primaryBranch) continue;
    
    try {
      await sleep(DELAY_BETWEEN_REQUESTS);
      
      const token = await getRequestToken(branch);
      await sleep(DELAY_BETWEEN_REQUESTS);
      
      const carData = await fetchCarData(branch, token, car.rentprog_car_id);
      
      if (carData && carData.seasons && carData.seasons.length > 0) {
        const result = await upsertCarPrices(car.car_uuid, carData);
        savedCount = result.inserted + result.updated;
        
        if (savedCount > 0) {
          console.log(`   ✅ Найдено в ${branch}! Сохранено: ${result.inserted} новых, ${result.updated} обновлено`);
          stats.withPrices++;
          stats.saved += savedCount;
          foundData = true;
        } else {
          console.log(`   ⚠️  Найдено в ${branch}, но price_values пусты`);
          stats.withoutPrices++;
        }
        
        await saveCheckResult(car, savedCount > 0);
        return;
      }
    } catch (error) {
      if (error.message.includes('Rate limit')) {
        console.log(`   ⏸️  Rate limit! Пауза 60 сек...`);
        await sleep(60000);
        return;
      }
    }
  }
  
  if (!foundData) {
    console.log(`   ❌ Не найдено данных ни в одном филиале`);
    stats.withoutPrices++;
    await saveCheckResult(car, false);
  }
}

async function main() {
  try {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   Массовая загрузка цен автомобилей из RentProg API     ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    
    // Получаем список авто без цен
    const BATCH_SIZE = 50; // Обрабатываем по 50 авто за раз
    
    console.log(`🔍 Поиск автомобилей без цен (лимит: ${BATCH_SIZE})...\n`);
    const cars = await getCarsWithoutPrices(BATCH_SIZE);
    
    if (cars.length === 0) {
      console.log('✅ Все автомобили уже имеют цены!');
      return;
    }
    
    stats.total = cars.length;
    console.log(`📊 Найдено: ${stats.total} автомобилей\n`);
    console.log(`⏱️  Ожидаемое время: ~${Math.ceil(stats.total * 4 / 60)} минут\n`);
    console.log('▶️  Начинаем обработку...\n');
    
    // Обрабатываем по одному с задержками
    for (let i = 0; i < cars.length; i++) {
      await processCar(cars[i], i + 1, cars.length);
      
      // Задержка между машинами
      if (i < cars.length - 1) {
        await sleep(DELAY_BETWEEN_CARS);
      }
      
      // Промежуточная статистика каждые 10 машин
      if ((i + 1) % 10 === 0) {
        console.log(`\n📊 Промежуточная статистика:`);
        console.log(`   Обработано: ${stats.processed}/${stats.total}`);
        console.log(`   С ценами: ${stats.withPrices} | Без цен: ${stats.withoutPrices}`);
        console.log(`   Сохранено записей: ${stats.saved}`);
        console.log(`   Ошибок: ${stats.errors}\n`);
      }
    }
    
    // Финальная статистика
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║                   ИТОГОВАЯ СТАТИСТИКА                    ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    console.log(`📊 Всего обработано: ${stats.processed} автомобилей`);
    console.log(`✅ С ценами: ${stats.withPrices}`);
    console.log(`⚠️  Без цен в RentProg: ${stats.withoutPrices}`);
    console.log(`💾 Сохранено записей: ${stats.saved}`);
    console.log(`❌ Ошибок: ${stats.errors}\n`);
    
    console.log('✨ Готово!\n');
    
  } catch (error) {
    console.error('\n❌ Критическая ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

