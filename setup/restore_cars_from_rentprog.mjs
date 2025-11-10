#!/usr/bin/env node
/**
 * Восстановление данных машин из RentProg API
 * Последовательно получает данные из всех 4 филиалов и сохраняет в БД
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

const BASE_URL = 'https://rentprog.net/api/v1/public';

// Токены филиалов (из workflow)
const BRANCH_TOKENS = {
  'tbilisi': '91b83b93963633649f29a04b612bab3f9fbb0471b5928622',
  'batumi': '7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d',
  'kutaisi': '5599ebb7b94827fdfd49ca3a5b7e259cfa99d8ea78edeb50',
  'service-center': '5y4j4gcs75o9n5s1e2vrxx4a'
};

// Маппинг company_id → branch_code
const COMPANY_TO_BRANCH = {
  '9247': 'tbilisi',
  '9506': 'batumi',
  '9248': 'kutaisi',
  '11163': 'service-center'
};

const BRANCHES = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];

// Консервативные задержки согласно инструкциям (используем ~33% от лимитов RentProg)
const DELAY_BETWEEN_GET_REQUESTS = 1500;  // 1.5 сек = 40 запросов/мин (лимит RentProg: 120/мин)
const DELAY_BETWEEN_POST_REQUESTS = 3000; // 3 сек = 20 запросов/мин (лимит RentProg: 60/мин)
const DELAY_BETWEEN_BRANCHES = 5000;      // 5 сек между филиалами

// Кэш токенов по филиалам (TTL ~240 секунд = 4 минуты)
const tokenCache = new Map();
const TOKEN_CACHE_TTL = 238000; // 238 секунд (с запасом 2 сек)

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getRequestToken(branch, retries = 3) {
  const companyToken = BRANCH_TOKENS[branch];
  if (!companyToken) {
    throw new Error(`No token for branch: ${branch}`);
  }

  // Проверяем кэш токена
  const cached = tokenCache.get(branch);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`  🔑 Использование кэшированного токена для ${branch}...`);
    return cached.token;
  }

  console.log(`  🔑 Получение нового токена для ${branch}...`);
  
  // Задержка перед запросом токена (POST запрос = 3 сек)
  await sleep(DELAY_BETWEEN_POST_REQUESTS);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${BASE_URL}/get_token?company_token=${companyToken}`, {
        method: 'GET'
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 429) {
          if (attempt < retries) {
            const waitTime = 10 * attempt; // 10, 20, 30 секунд
            console.log(`  ⚠️  Rate limit exceeded. Waiting ${waitTime} seconds before retry ${attempt + 1}/${retries}...`);
            await sleep(waitTime * 1000);
            continue;
          }
          throw new Error(`Rate limit exceeded after ${retries} attempts`);
        }
        throw new Error(`Failed to get token: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      if (!data.token) {
        throw new Error('Empty token in response');
      }

      // Сохраняем токен в кэш
      tokenCache.set(branch, {
        token: data.token,
        expiresAt: Date.now() + TOKEN_CACHE_TTL
      });

      return data.token;
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      console.log(`  ⚠️  Attempt ${attempt} failed: ${error.message}. Retrying...`);
      await sleep(5000 * attempt); // Увеличиваем задержку с каждой попыткой
    }
  }
}

async function fetchCars(branch, token) {
  console.log(`  📡 Получение машин из ${branch}...`);
  
  try {
    // Используем /all_cars_full с пагинацией для получения всех полей
    let allCars = [];
    let page = 0;
    const limit = 20;
    
    while (true) {
      const response = await fetch(`${BASE_URL}/all_cars_full?limit=${limit}&page=${page}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Origin': 'https://web.rentprog.ru',
          'Referer': 'https://web.rentprog.ru/',
          'User-Agent': 'Mozilla/5.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      const data = await response.json();
      const cars = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : (Array.isArray(data?.cars) ? data.cars : []));
      
      if (cars.length === 0) break;
      
      allCars.push(...cars);
      
      if (cars.length < limit) break; // Последняя страница
      
      page++;
      await sleep(DELAY_BETWEEN_GET_REQUESTS); // 1.5 сек между страницами (GET запросы)
    }
    
    return allCars;
    
  } catch (error) {
    console.error(`  ❌ Ошибка получения машин: ${error.message}`);
    return [];
  }
}

async function getOrCreateBranch(branchCode) {
  const branch = await sql`
    SELECT id FROM branches WHERE code = ${branchCode} LIMIT 1
  `;
  
  if (branch.length > 0) {
    return branch[0].id;
  }
  
  // Создаем филиал, если не существует
  const names = {
    'tbilisi': 'Тбилиси',
    'batumi': 'Батуми',
    'kutaisi': 'Кутаиси',
    'service-center': 'Сервис'
  };
  
  const [newBranch] = await sql`
    INSERT INTO branches (code, name, created_at, updated_at)
    VALUES (${branchCode}, ${names[branchCode] || branchCode}, NOW(), NOW())
    RETURNING id
  `;
  
  return newBranch.id;
}

async function upsertCar(car, branchId, branchCode) {
  const rentprogId = String(car.id);
  const companyId = String(car.company_id || '');
  
  // Определяем branch_code по company_id, если не указан
  const actualBranchCode = COMPANY_TO_BRANCH[companyId] || branchCode;
  const actualBranchId = await getOrCreateBranch(actualBranchCode);
  
  // Маппинг полей: number → plate, car_name → model
  const plate = car.number || null;
  const model = car.car_name || car.model || null;
  
  // Пропускаем фейковые номера формата AA-999-AA
  if (plate && /^([A-Za-z]{2}-\d{3}-[A-Za-z]{2})$/.test(plate)) {
    return 'skipped';
  }
  
  // Формируем значения для upsert
  const formatValue = (val, field, isBool = false) => {
    if (val === null || val === undefined || val === '') return null;
    
    if (isBool) {
      return val === 'true' || val === true || val === 1 || val === '1';
    }
    
    // Числовые поля
    if (['state', 'year', 'mileage', 'number_doors', 'number_seats', 'tire_type',
         'franchise', 'max_fine', 'start_mileage', 'tank_value',
         'repair_cost', 'extra_mileage_km', 'extra_mileage_price',
         'engine_power', 'engine_capacity', 'trunk_volume', 'gas_mileage'].includes(field)) {
      const num = Number(val);
      return Number.isNaN(num) ? null : num;
    }
    
    return String(val).trim() || null;
  };
  
  // Маппинг всех полей из API
  const fieldMapping = {
    // Основные
    company_id: { api: 'company_id', db: 'company_id' },
    car_name: { api: 'car_name', db: 'model' },
    number: { api: 'number', db: 'plate' },
    state: { api: 'state', db: 'state' },
    transmission: { api: 'transmission', db: 'transmission' },
    year: { api: 'year', db: 'year' },
    color: { api: 'color', db: 'color' },
    mileage: { api: 'mileage', db: 'mileage' },
    car_type: { api: 'car_type', db: 'car_type' },
    interior: { api: 'interior', db: 'interior' },
    car_class: { api: 'car_class', db: 'car_class' },
    code: { api: 'code', db: 'code' },
    drive_unit: { api: 'drive_unit', db: 'drive_unit' },
    steering_side: { api: 'steering_side', db: 'steering_side' },
    fuel: { api: 'fuel', db: 'fuel' },
    
    // Характеристики
    number_doors: { api: 'number_doors', db: 'number_doors' },
    number_seats: { api: 'number_seats', db: 'number_seats' },
    engine_capacity: { api: 'engine_capacity', db: 'engine_capacity' },
    engine_power: { api: 'engine_power', db: 'engine_power' },
    trunk_volume: { api: 'trunk_volume', db: 'trunk_volume' },
    tire_size: { api: 'tire_size', db: 'tire_size' },
    tire_type: { api: 'tire_type', db: 'tire_type' },
    gas_mileage: { api: 'gas_mileage', db: 'gas_mileage' },
    
    // Дополнительные
    vin: { api: 'vin', db: 'vin' },
    body_number: { api: 'body_number', db: 'body_number' },
    pts: { api: 'pts', db: 'pts' },
    registration_certificate: { api: 'registration_certificate', db: 'registration_certificate' },
    start_mileage: { api: 'start_mileage', db: 'start_mileage' },
    tank_value: { api: 'tank_value', db: 'tank_value' },
    franchise: { api: 'franchise', db: 'franchise' },
    max_fine: { api: 'max_fine', db: 'max_fine' },
    repair_cost: { api: 'repair_cost', db: 'repair_cost' },
    store_place: { api: 'store_place', db: 'store_place' },
    roof: { api: 'roof', db: 'roof' },
    custom_field_1: { api: 'custom_field_1', db: 'custom_field_1' },
    custom_field_2: { api: 'custom_field_2', db: 'custom_field_2' },
    custom_field_3: { api: 'custom_field_3', db: 'custom_field_3' },
    window_lifters: { api: 'window_lifters', db: 'window_lifters' },
    extra_mileage_km: { api: 'extra_mileage_km', db: 'extra_mileage_km' },
    extra_mileage_price: { api: 'extra_mileage_price', db: 'extra_mileage_price' },
    insurance: { api: 'insurance', db: 'insurance' },
    avatar_url: { api: 'avatar_url', db: 'avatar_url' },
    
    // Boolean поля
    is_air: { api: 'is_air', db: 'is_air', isBool: true },
    abs: { api: 'abs', db: 'abs', isBool: true },
    ebd: { api: 'ebd', db: 'ebd', isBool: true },
    esp: { api: 'esp', db: 'esp', isBool: true },
    is_electropackage: { api: 'is_electropackage', db: 'is_electropackage', isBool: true },
    cd_system: { api: 'cd_system', db: 'cd_system', isBool: true },
    tv_system: { api: 'tv_system', db: 'tv_system', isBool: true },
    parktronic: { api: 'parktronic', db: 'parktronic', isBool: true },
    parktronic_back: { api: 'parktronic_back', db: 'parktronic_back', isBool: true },
    parktronic_camera: { api: 'parktronic_camera', db: 'parktronic_camera', isBool: true },
    tank_state: { api: 'tank_state', db: 'tank_state', isBool: true },
    heated_seats: { api: 'heated_seats', db: 'heated_seats', isBool: true },
    heated_seats_front: { api: 'heated_seats_front', db: 'heated_seats_front', isBool: true },
    clean_state: { api: 'clean_state', db: 'clean_state', isBool: true },
    audio_system: { api: 'audio_system', db: 'audio_system', isBool: true },
    video_system: { api: 'video_system', db: 'video_system', isBool: true },
    folding_seats: { api: 'folding_seats', db: 'folding_seats', isBool: true },
    climate_control: { api: 'climate_control', db: 'climate_control', isBool: true },
    usb_system: { api: 'usb_system', db: 'usb_system', isBool: true },
    rain_sensor: { api: 'rain_sensor', db: 'rain_sensor', isBool: true },
    wheel_adjustment: { api: 'wheel_adjustment', db: 'wheel_adjustment', isBool: true },
    wheel_adjustment_full: { api: 'wheel_adjustment_full', db: 'wheel_adjustment_full', isBool: true },
    heated_windshield: { api: 'heated_windshield', db: 'heated_windshield', isBool: true }
  };
  
  // Проверяем, существует ли машина
  const existing = await sql`
    SELECT c.id 
    FROM cars c
    JOIN external_refs er ON er.entity_id = c.id
    WHERE er.system = 'rentprog'
      AND er.entity_type = 'car'
      AND er.external_id = ${rentprogId}
    LIMIT 1
  `;
  
  let carId;
  
  if (existing.length > 0) {
    // UPDATE существующей машины
    carId = existing[0].id;
    
    const updateFields = [];
    const updateValues = [];
    
    // Обновляем branch_id если изменился
    if (actualBranchId) {
      updateFields.push('branch_id');
      updateValues.push(actualBranchId);
    }
    
    // Проходим по всем полям из fieldMapping
    for (const [fieldKey, fieldConfig] of Object.entries(fieldMapping)) {
      const apiField = fieldConfig.api;
      const dbField = fieldConfig.db;
      const isBool = fieldConfig.isBool || false;
      
      let apiValue = car[apiField];
      
      // Пропускаем пустые значения (кроме boolean и state)
      if (apiValue === null || apiValue === undefined || apiValue === '') {
        if (!isBool && fieldKey !== 'state') continue;
      }
      
      const formattedValue = formatValue(apiValue, dbField, isBool);
      
      if (formattedValue !== null || (isBool && formattedValue === false)) {
        updateFields.push(dbField);
        updateValues.push(formattedValue);
      }
    }
    
    updateFields.push('updated_at');
    updateValues.push('NOW()');
    
    if (updateFields.length > 1) { // Больше чем just updated_at
      const setClause = updateFields.map((field, idx) => {
        const value = updateValues[idx];
        if (value === null) return `${field} = NULL`;
        if (typeof value === 'boolean') return `${field} = ${value}`;
        if (typeof value === 'number') return `${field} = ${value}`;
        if (value === 'NOW()') return `${field} = NOW()`;
        return `${field} = '${String(value).replace(/'/g, "''")}'`;
      }).join(', ');
      
      await sql.unsafe(`
        UPDATE cars 
        SET ${setClause}
        WHERE id = '${carId}'
      `);
    }
    
    return 'updated';
  } else {
    // INSERT новой машины
    const fields = ['id', 'branch_id', 'created_at', 'updated_at'];
    const values = ['gen_random_uuid()', `'${actualBranchId}'`, 'NOW()', 'NOW()'];
    
    // Проходим по всем полям из fieldMapping
    for (const [fieldKey, fieldConfig] of Object.entries(fieldMapping)) {
      const apiField = fieldConfig.api;
      const dbField = fieldConfig.db;
      const isBool = fieldConfig.isBool || false;
      
      let apiValue = car[apiField];
      
      // Пропускаем пустые значения (кроме boolean и state)
      if (apiValue === null || apiValue === undefined || apiValue === '') {
        if (!isBool && fieldKey !== 'state') continue;
      }
      
      const formattedValue = formatValue(apiValue, dbField, isBool);
      
      if (formattedValue !== null || (isBool && formattedValue === false)) {
        fields.push(dbField);
        if (formattedValue === null) {
          values.push('NULL');
        } else if (typeof formattedValue === 'boolean') {
          values.push(formattedValue ? 'TRUE' : 'FALSE');
        } else if (typeof formattedValue === 'number') {
          values.push(String(formattedValue));
        } else {
          values.push(`'${String(formattedValue).replace(/'/g, "''")}'`);
        }
      }
    }
    
    const insertQuery = `
      DO $$
      DECLARE
        new_car_id UUID;
      BEGIN
        INSERT INTO cars (${fields.join(', ')})
        VALUES (${values.join(', ')})
        RETURNING id INTO new_car_id;
        
        INSERT INTO external_refs (entity_type, entity_id, system, external_id)
        VALUES ('car', new_car_id, 'rentprog', '${rentprogId}')
        ON CONFLICT (system, external_id) DO UPDATE SET
          entity_id = EXCLUDED.entity_id,
          updated_at = NOW();
      END $$;
    `;
    
    await sql.unsafe(insertQuery);
    
    return 'inserted';
  }
}

async function processBranch(branch) {
  console.log(`\n📋 Обработка филиала: ${branch}`);
  console.log('━'.repeat(50));
  
  try {
    // Получаем токен (с кэшированием)
    const token = await getRequestToken(branch);
    // Небольшая задержка после получения токена перед первым запросом
    await sleep(500);
    
    // Получаем машины
    const cars = await fetchCars(branch, token);
    console.log(`  ✅ Получено машин: ${cars.length}`);
    
    if (cars.length === 0) {
      console.log(`  ⚠️  Нет машин для филиала ${branch}`);
      return { branch, total: 0, inserted: 0, updated: 0, skipped: 0 };
    }
    
    // Получаем branch_id
    const branchId = await getOrCreateBranch(branch);
    
    // Обрабатываем каждую машину
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const car of cars) {
      try {
        const result = await upsertCar(car, branchId, branch);
        if (result === 'inserted') {
          inserted++;
        } else if (result === 'updated') {
          updated++;
        } else if (result === 'skipped') {
          skipped++;
        }
      } catch (error) {
        console.error(`  ❌ Ошибка при обработке машины ${car.id}: ${error.message}`);
      }
      
      // Небольшая задержка между машинами
      if (cars.indexOf(car) % 10 === 0 && cars.indexOf(car) > 0) {
        await sleep(100);
      }
    }
    
    console.log(`  📊 Результаты:`);
    console.log(`     Добавлено: ${inserted}`);
    console.log(`     Обновлено: ${updated}`);
    console.log(`     Пропущено: ${skipped}`);
    
    return { branch, total: cars.length, inserted, updated, skipped };
    
  } catch (error) {
    console.error(`  ❌ Ошибка при обработке филиала ${branch}: ${error.message}`);
    return { branch, total: 0, inserted: 0, updated: 0, skipped: 0, error: error.message };
  }
}

async function main() {
  console.log('🚀 Восстановление данных машин из RentProg API');
  console.log('━'.repeat(50));
  console.log(`📅 Дата: ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })}`);
  console.log('');
  
  const results = [];
  
  // Обрабатываем филиалы последовательно
  for (const branch of BRANCHES) {
    const result = await processBranch(branch);
    results.push(result);
    
    // Задержка между филиалами
    if (branch !== BRANCHES[BRANCHES.length - 1]) {
      await sleep(DELAY_BETWEEN_BRANCHES);
    }
  }
  
  // Итоговая статистика
  console.log('\n' + '━'.repeat(50));
  console.log('📊 ИТОГОВАЯ СТАТИСТИКА');
  console.log('━'.repeat(50));
  
  let totalCars = 0;
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  
  for (const result of results) {
    console.log(`${result.branch}:`);
    console.log(`  Всего машин: ${result.total}`);
    console.log(`  Добавлено: ${result.inserted}`);
    console.log(`  Обновлено: ${result.updated}`);
    console.log(`  Пропущено: ${result.skipped}`);
    if (result.error) {
      console.log(`  ❌ Ошибка: ${result.error}`);
    }
    console.log('');
    
    totalCars += result.total;
    totalInserted += result.inserted;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
  }
  
  console.log('━'.repeat(50));
  console.log(`Всего обработано машин: ${totalCars}`);
  console.log(`Добавлено новых: ${totalInserted}`);
  console.log(`Обновлено существующих: ${totalUpdated}`);
  console.log(`Пропущено (фейковые номера): ${totalSkipped}`);
  console.log('━'.repeat(50));
  
  await sql.end();
  console.log('\n✅ Готово!');
}

main().catch(error => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});

