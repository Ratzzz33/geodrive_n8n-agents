/**
 * Получение цен через RentProg API для машин без цен
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const BRANCH_TOKENS = {
  'tbilisi': '91b83b93963633649f29a04b612bab3f9fbb0471b5928622',
  'batumi': '7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d',
  'kutaisi': '5599ebb7b94827fdfd49ca3a5b7e259cfa99d8ea78edeb50',
  'service-center': '5y4j4gcs75o9n5s1e2vrxx4a'
};

const BASE_URL = 'https://rentprog.net/api/v1/public';

// Машины без цен
const CARS_WITHOUT_PRICES = [
  // Тбилиси
  { plate: 'IV430AN', branch: 'tbilisi', model: 'BMW 430i Cabrio' },
  { plate: 'BZ551ZB', branch: 'tbilisi', model: 'Chevrolet Cruze HR' },
  { plate: 'RV933RR', branch: 'tbilisi', model: 'Honda HR-V' },
  { plate: 'CR106CR', branch: 'tbilisi', model: 'Honda Odyssey' },
  { plate: 'NN371KN', branch: 'tbilisi', model: 'Mazda 3' },
  { plate: 'NN626CC', branch: 'tbilisi', model: 'Mazda 6' },
  { plate: 'EP021EP', branch: 'tbilisi', model: 'Toyota Rav 4' },
  { plate: 'JU904UU', branch: 'tbilisi', model: 'Toyota Rav 4' },
  { plate: 'GT183GG', branch: 'tbilisi', model: 'Volkswagen Tiguan' },
  
  // Сервисный центр
  { plate: 'UN522UN', branch: 'service-center', model: 'Buick Encore' },
  { plate: 'EE377EI', branch: 'service-center', model: 'Hyundai Tucson' },
  { plate: 'MM423QM', branch: 'service-center', model: 'Hyundai Veloster' },
  { plate: 'HG541HG', branch: 'service-center', model: 'Volkswagen Jetta' },
  { plate: 'BB681BF', branch: 'service-center', model: 'Volkswagen Tiguan' },
  
  // Кутаиси
  { plate: 'II179IE', branch: 'kutaisi', model: 'Hyundai Veloster' },
  { plate: 'WT572WT', branch: 'kutaisi', model: 'Kia Sportage' },
  { plate: 'WX370WX', branch: 'kutaisi', model: 'Mercedes GLS 450' },
  
  // Батуми
  { plate: 'DF368DD', branch: 'batumi', model: 'Kia Sportage' },
  { plate: 'AR958ES', branch: 'batumi', model: 'Porsche Cayenne GTS' },
  
  // Без филиала
  { plate: 'FH785FH', branch: null, model: 'Mini Cooper S' }
];

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

// Получить токен
async function getRequestToken(branch) {
  const companyToken = BRANCH_TOKENS[branch];
  if (!companyToken) {
    throw new Error(`Unknown branch: ${branch}`);
  }

  const response = await fetch(`${BASE_URL}/get_token?company_token=${companyToken}`, {
    method: 'GET'
  });

  if (!response.ok) {
    throw new Error(`Failed to get token: ${response.status}`);
  }

  const data = await response.json();
  return data.token;
}

// Получить данные машины из RentProg
async function fetchCarData(rentprogId, token) {
  const url = `${BASE_URL}/car_data_with_bookings?car_id=${rentprogId}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (response.status === 404) {
    return null; // Машина не найдена
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch car: ${response.status}`);
  }

  return await response.json();
}

// Upsert цен
async function upsertCarPrices(carId, carData) {
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
    if (season) {
      priceData.season = {
        start_date: season.start_date,
        end_date: season.end_date
      };
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
            currency = 'GEL',
            exchange_rate = 2.7,
            updated_at = NOW()
        WHERE id = ${existing[0].id}
      `;
      updated++;
    } else {
      // INSERT
      try {
        await sql`
          INSERT INTO car_prices (car_id, season_id, rentprog_price_id, price_values, currency, exchange_rate, created_at, updated_at)
          VALUES (${carId}, ${seasonId}, ${rentprogPriceId}, ${JSON.stringify(priceData)}, 'GEL', 2.7, NOW(), NOW())
        `;
        inserted++;
      } catch (error) {
        if (!error.message.includes('duplicate key')) {
          throw error;
        }
      }
    }
  }

  return { inserted, updated };
}

// Главная функция
async function main() {
  console.log('🔍 Поиск цен для 20 машин через RentProg API...\n');

  let totalInserted = 0;
  let totalUpdated = 0;
  let notFound = 0;
  let noPrices = 0;
  let errors = 0;

  try {
    // Группируем по филиалам
    const byBranch = {};
    CARS_WITHOUT_PRICES.forEach(car => {
      const branch = car.branch || 'unknown';
      if (!byBranch[branch]) byBranch[branch] = [];
      byBranch[branch].push(car);
    });

    for (const [branch, cars] of Object.entries(byBranch)) {
      if (branch === 'unknown') {
        console.log(`⚠️  Пропущено ${cars.length} машин без филиала\n`);
        notFound += cars.length;
        continue;
      }

      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📍 ${branch.toUpperCase()}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // Получить токен
      const token = await getRequestToken(branch);

      for (const carInfo of cars) {
        try {
          // Найти машину в нашей БД
          const ourCar = await sql`
            SELECT c.id, c.model, c.plate
            FROM cars c
            JOIN branches b ON b.id = c.branch_id
            WHERE c.plate = ${carInfo.plate}
              AND b.code = ${branch}
            LIMIT 1
          `;

          if (ourCar.length === 0) {
            console.log(`❌ ${carInfo.model} (${carInfo.plate}) - не найдена в нашей БД`);
            notFound++;
            continue;
          }

          // Получить RentProg ID через external_refs
          const extRef = await sql`
            SELECT external_id
            FROM external_refs
            WHERE entity_id = ${ourCar[0].id}
              AND entity_type = 'car'
              AND system = 'rentprog'
            LIMIT 1
          `;

          if (extRef.length === 0) {
            console.log(`❌ ${carInfo.model} (${carInfo.plate}) - нет external_ref`);
            notFound++;
            continue;
          }

          const rentprogId = extRef[0].external_id;

          // Получить данные из RentProg
          const carData = await fetchCarData(rentprogId, token);

          if (!carData) {
            console.log(`❌ ${carInfo.model} (${carInfo.plate}) - не найдена в RentProg (RP ID: ${rentprogId})`);
            notFound++;
            continue;
          }

          // Проверить наличие цен
          if (!carData.prices || carData.prices.length === 0) {
            console.log(`⚠️  ${carInfo.model} (${carInfo.plate}) - нет цен в RentProg`);
            noPrices++;
            continue;
          }

          // Upsert цены
          const result = await upsertCarPrices(ourCar[0].id, carData);

          if (result.inserted > 0 || result.updated > 0) {
            console.log(`✅ ${carInfo.model} (${carInfo.plate}) - +${result.inserted} ~${result.updated} цен`);
            totalInserted += result.inserted;
            totalUpdated += result.updated;
          } else {
            console.log(`⚠️  ${carInfo.model} (${carInfo.plate}) - все цены = 0`);
            noPrices++;
          }

          // Задержка между запросами
          await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
          console.error(`❌ ${carInfo.model} (${carInfo.plate}) - ошибка: ${error.message}`);
          errors++;
        }
      }

      console.log('');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 ИТОГОВАЯ СТАТИСТИКА');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log(`Всего машин обработано: ${CARS_WITHOUT_PRICES.length}`);
    console.log(`✅ Цены добавлены: ${totalInserted} записей`);
    console.log(`🔄 Цены обновлены: ${totalUpdated} записей`);
    console.log(`❌ Не найдены в RentProg: ${notFound}`);
    console.log(`⚠️  Без цен в RentProg: ${noPrices}`);
    console.log(`🔥 Ошибок: ${errors}\n`);

  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
  } finally {
    await sql.end();
  }
}

main();

