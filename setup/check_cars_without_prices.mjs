/**
 * Скрипт для проверки автомобилей без цен на сезоны
 * Использует RentProg API endpoint /car_data_with_bookings
 */

import postgres from 'postgres';
import fetch from 'node-fetch';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

// Токены филиалов (company tokens)
// Сначала пробуем получить из RENTPROG_BRANCH_KEYS (JSON)
let BRANCH_TOKENS = {
  'tbilisi': process.env.RENTPROG_TOKEN_TBILISI,
  'batumi': process.env.RENTPROG_TOKEN_BATUMI,
  'kutaisi': process.env.RENTPROG_TOKEN_KUTAISI,
  'service-center': process.env.RENTPROG_TOKEN_SERVICE_CENTER
};

// Если не установлены, пробуем из RENTPROG_BRANCH_KEYS
if (!BRANCH_TOKENS.tbilisi && process.env.RENTPROG_BRANCH_KEYS) {
  try {
    BRANCH_TOKENS = JSON.parse(process.env.RENTPROG_BRANCH_KEYS);
    console.log('✅ Токены загружены из RENTPROG_BRANCH_KEYS');
  } catch (e) {
    console.error('❌ Ошибка парсинга RENTPROG_BRANCH_KEYS:', e.message);
  }
}

// Проверка наличия токенов
const missingTokens = Object.entries(BRANCH_TOKENS).filter(([_, token]) => !token).map(([branch]) => branch);
if (missingTokens.length > 0) {
  console.error(`❌ Отсутствуют токены для филиалов: ${missingTokens.join(', ')}`);
  console.error('   Установите RENTPROG_BRANCH_KEYS или отдельные RENTPROG_TOKEN_* переменные');
  process.exit(1);
}

const BASE_URL = 'https://rentprog.net/api/v1/public';

/**
 * Получить временный токен авторизации (request token)
 * @param {string} branch - Код филиала
 * @returns {Promise<{token: string, expiresAt: Date}>}
 */
async function getRequestToken(branch) {
  const companyToken = BRANCH_TOKENS[branch];
  if (!companyToken) {
    throw new Error(`Неизвестный филиал: ${branch}`);
  }

  console.log(`[${branch}] Получение request token...`);
  
  // Используем правильный endpoint как в rentprog.ts
  const authUrl = `${BASE_URL}/get_token?company_token=${companyToken}`;
  
  const response = await fetch(authUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Ошибка получения токена: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.token) {
    throw new Error('Токен не получен в ответе API');
  }

  const expiresAt = new Date(data.exp);
  console.log(`[${branch}] Request token получен, истекает: ${expiresAt.toISOString()}`);
  
  return {
    token: data.token,
    expiresAt
  };
}

/**
 * Получить список всех автомобилей филиала
 * @param {string} branch - Код филиала
 * @param {string} token - Request token
 * @returns {Promise<Array>}
 */
async function getAllCars(branch, token) {
  console.log(`[${branch}] Получение списка автомобилей...`);
  
  const response = await fetch(`${BASE_URL}/all_cars`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Ошибка получения списка авто: ${response.status}`);
  }

  const cars = await response.json();
  console.log(`[${branch}] Найдено автомобилей: ${cars.length}`);
  
  return cars;
}

/**
 * Получить детальную информацию об автомобиле через /car_data_with_bookings
 * @param {string} branch - Код филиала
 * @param {string} token - Request token
 * @param {string} carId - ID автомобиля в RentProg
 * @returns {Promise<Object|null>}
 */
async function getCarDataWithBookings(branch, token, carId) {
  try {
    const response = await fetch(`${BASE_URL}/car_data_with_bookings?car_id=${carId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`[${branch}] Ошибка получения данных авто ${carId}: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`[${branch}] Ошибка для авто ${carId}:`, error.message);
    return null;
  }
}

/**
 * Проверить наличие цен на сезоны
 * @param {Object} carData - Данные автомобиля из API
 * @returns {{hasPrices: boolean, seasons: number, pricesCount: number, details: Array}}
 */
function checkCarPrices(carData) {
  if (!carData) {
    return { hasPrices: false, seasons: 0, pricesCount: 0, details: [] };
  }

  const seasons = carData.seasons || [];
  const prices = carData.prices || [];
  
  // Проверяем есть ли хоть одна цена с ненулевыми значениями
  const validPrices = prices.filter(price => {
    const values = price.values || [];
    return values.some(v => v > 0);
  });

  const details = seasons.map(season => {
    const seasonPrice = prices.find(p => p.season_id === season.id);
    const hasValidPrice = seasonPrice && seasonPrice.values?.some(v => v > 0);
    
    return {
      seasonId: season.id,
      seasonName: season.name,
      startDate: season.start_date,
      endDate: season.end_date,
      hasPrices: hasValidPrice,
      priceValues: seasonPrice?.values || []
    };
  });

  return {
    hasPrices: validPrices.length > 0,
    seasons: seasons.length,
    pricesCount: validPrices.length,
    details
  };
}

/**
 * Сохранить результаты проверки в БД
 * @param {Object} sql - Postgres client
 * @param {string} branch - Код филиала
 * @param {Array} carsWithoutPrices - Список авто без цен
 */
async function saveCheckResults(sql, branch, carsWithoutPrices) {
  // Создаем таблицу если не существует
  await sql`
    CREATE TABLE IF NOT EXISTS car_price_checks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      branch TEXT NOT NULL,
      car_id UUID,
      rentprog_car_id TEXT NOT NULL,
      car_code TEXT,
      car_number TEXT,
      car_model TEXT,
      seasons_count INTEGER DEFAULT 0,
      prices_count INTEGER DEFAULT 0,
      missing_seasons JSONB,
      check_data JSONB,
      checked_at TIMESTAMPTZ DEFAULT NOW(),
      resolved BOOLEAN DEFAULT FALSE,
      resolved_at TIMESTAMPTZ
    )
  `;

  // Создаем индексы если не существуют
  await sql`CREATE INDEX IF NOT EXISTS idx_car_price_checks_branch ON car_price_checks(branch)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_car_price_checks_resolved ON car_price_checks(resolved)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_car_price_checks_checked_at ON car_price_checks(checked_at)`;

  console.log(`\n[${branch}] Сохранение результатов в БД...`);
  
  for (const car of carsWithoutPrices) {
    // Найти наш ID автомобиля через external_refs
    const ourCar = await sql`
      SELECT c.id 
      FROM cars c
      INNER JOIN external_refs er ON er.entity_id = c.id
      WHERE er.system = 'rentprog'
        AND er.entity_type = 'car'
        AND er.external_id = ${car.rentprogId}
        AND er.branch_code = ${branch}
      LIMIT 1
    `;

    const carId = ourCar.length > 0 ? ourCar[0].id : null;

    // Вставляем запись о проверке
    await sql`
      INSERT INTO car_price_checks (
        branch, car_id, rentprog_car_id, car_code, car_number, car_model,
        seasons_count, prices_count, missing_seasons, check_data
      )
      VALUES (
        ${branch},
        ${carId},
        ${car.rentprogId},
        ${car.code},
        ${car.number},
        ${car.model},
        ${car.priceCheck.seasons},
        ${car.priceCheck.pricesCount},
        ${JSON.stringify(car.priceCheck.details)},
        ${JSON.stringify(car.carData)}
      )
      ON CONFLICT DO NOTHING
    `;
  }

  console.log(`[${branch}] Сохранено записей: ${carsWithoutPrices.length}`);
}

/**
 * Проверить автомобили филиала без цен
 * @param {string} branch - Код филиала
 * @returns {Promise<Object>}
 */
async function checkBranchCarsWithoutPrices(branch) {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Получаем временный токен
    const { token } = await getRequestToken(branch);

    // Получаем список всех авто
    const allCars = await getAllCars(branch, token);

    console.log(`\n[${branch}] Проверка цен для ${allCars.length} автомобилей...`);

    const carsWithoutPrices = [];
    let checked = 0;
    let errors = 0;

    // Проверяем каждый автомобиль
    for (const car of allCars) {
      try {
        // Получаем детальные данные
        const carData = await getCarDataWithBookings(branch, token, car.id);
        
        if (!carData) {
          errors++;
          continue;
        }

        // Проверяем цены
        const priceCheck = checkCarPrices(carData);
        checked++;

        // Если нет цен - добавляем в список
        if (!priceCheck.hasPrices || priceCheck.pricesCount === 0) {
          carsWithoutPrices.push({
            rentprogId: String(car.id),
            code: car.code,
            number: car.number,
            model: car.model || car.name,
            priceCheck,
            carData
          });

          console.log(`[${branch}] ❌ ${car.number || car.code}: НЕТ ЦЕН (сезонов: ${priceCheck.seasons}, цен: ${priceCheck.pricesCount})`);
        } else {
          console.log(`[${branch}] ✅ ${car.number || car.code}: есть цены (${priceCheck.pricesCount}/${priceCheck.seasons})`);
        }

        // Небольшая пауза чтобы не нагружать API
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`[${branch}] Ошибка проверки авто ${car.id}:`, error.message);
        errors++;
      }
    }

    // Сохраняем результаты в БД
    if (carsWithoutPrices.length > 0) {
      await saveCheckResults(sql, branch, carsWithoutPrices);
    }

    const result = {
      branch,
      total: allCars.length,
      checked,
      withoutPrices: carsWithoutPrices.length,
      withPrices: checked - carsWithoutPrices.length,
      errors,
      cars: carsWithoutPrices
    };

    console.log(`\n[${branch}] ========== ИТОГИ ==========`);
    console.log(`[${branch}] Всего автомобилей: ${result.total}`);
    console.log(`[${branch}] Проверено: ${result.checked}`);
    console.log(`[${branch}] Без цен: ${result.withoutPrices}`);
    console.log(`[${branch}] С ценами: ${result.withPrices}`);
    console.log(`[${branch}] Ошибок: ${result.errors}`);

    return result;

  } finally {
    await sql.end();
  }
}

/**
 * Проверить все филиалы
 */
async function checkAllBranches() {
  const branches = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
  const results = [];

  console.log('🔍 Начинаю проверку автомобилей без цен на сезоны...\n');

  for (const branch of branches) {
    try {
      const result = await checkBranchCarsWithoutPrices(branch);
      results.push(result);
    } catch (error) {
      console.error(`\n❌ Ошибка для филиала ${branch}:`, error.message);
      results.push({
        branch,
        error: error.message,
        total: 0,
        checked: 0,
        withoutPrices: 0,
        withPrices: 0,
        errors: 1,
        cars: []
      });
    }
  }

  // Общая статистика
  console.log('\n\n========== ОБЩАЯ СТАТИСТИКА ==========');
  const totals = results.reduce((acc, r) => ({
    total: acc.total + r.total,
    checked: acc.checked + r.checked,
    withoutPrices: acc.withoutPrices + r.withoutPrices,
    withPrices: acc.withPrices + r.withPrices,
    errors: acc.errors + r.errors
  }), { total: 0, checked: 0, withoutPrices: 0, withPrices: 0, errors: 0 });

  console.log(`Всего автомобилей: ${totals.total}`);
  console.log(`Проверено: ${totals.checked}`);
  console.log(`Без цен: ${totals.withoutPrices}`);
  console.log(`С ценами: ${totals.withPrices}`);
  console.log(`Ошибок: ${totals.errors}`);

  // Детали по филиалам
  console.log('\n========== ПО ФИЛИАЛАМ ==========');
  for (const result of results) {
    console.log(`\n${result.branch}:`);
    console.log(`  Всего: ${result.total}`);
    console.log(`  Без цен: ${result.withoutPrices}`);
    if (result.withoutPrices > 0) {
      console.log(`  Список авто без цен:`);
      for (const car of result.cars.slice(0, 5)) { // Показываем первые 5
        console.log(`    - ${car.number || car.code} (${car.model})`);
      }
      if (result.cars.length > 5) {
        console.log(`    ... и еще ${result.cars.length - 5} автомобилей`);
      }
    }
  }

  return results;
}

// Запуск если вызван напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
  checkAllBranches()
    .then(() => {
      console.log('\n✅ Проверка завершена');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Ошибка:', error);
      process.exit(1);
    });
}

export { checkBranchCarsWithoutPrices, checkAllBranches, getRequestToken, getCarDataWithBookings, checkCarPrices };

