import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkExecution27779() {
  console.log('🔍 Проверка execution #27779 (2025-11-21 16:03:40)...\n');
  
  // Время execution: 2025-11-21T12:03:40.583Z - 2025-11-21T12:04:42.721Z
  const executionStart = new Date('2025-11-21T12:03:40.583Z');
  const executionEnd = new Date('2025-11-21T12:04:42.721Z');
  
  console.log(`   Период execution: ${executionStart.toISOString()} - ${executionEnd.toISOString()}\n`);
  
  // 1. Проверяем цены, сохраненные в период execution
  console.log('1️⃣ Проверка цен в БД за период execution...\n');
  
  const pricesInDB = await sql`
    SELECT 
      cp.id,
      cp.car_id,
      cp.rentprog_price_id,
      cp.season_id,
      cp.season_name,
      cp.price_values,
      cp.created_at,
      c.rentprog_id as car_rentprog_id,
      c.car_name,
      c.code
    FROM car_prices cp
    JOIN cars c ON c.id = cp.car_id
    WHERE cp.created_at >= ${executionStart}
      AND cp.created_at <= ${executionEnd}
    ORDER BY cp.created_at DESC
  `;
  
  console.log(`   📊 Цен сохранено в период execution: ${pricesInDB.length}`);
  
  if (pricesInDB.length > 0) {
    console.log(`\n   ✅ Цены сохранены в БД!`);
    console.log(`\n   Примеры сохраненных цен:`);
    pricesInDB.slice(0, 5).forEach((price, idx) => {
      console.log(`\n   ${idx + 1}. Машина: ${price.car_name || price.code || price.car_rentprog_id}`);
      console.log(`      RentProg Price ID: ${price.rentprog_price_id}`);
      console.log(`      Season ID: ${price.season_id} (${price.season_name || 'без названия'})`);
      console.log(`      Сохранено: ${price.created_at}`);
      
      if (price.price_values) {
        const pv = price.price_values;
        if (pv.values && Array.isArray(pv.values)) {
          const nonZeroValues = pv.values.filter(v => v && v > 0);
          console.log(`      ✅ Цены: ${nonZeroValues.length} ненулевых значений из ${pv.values.length}`);
          if (nonZeroValues.length > 0) {
            console.log(`         Примеры: ${nonZeroValues.slice(0, 3).join(', ')} GEL`);
          }
        }
      }
    });
  } else {
    console.log(`\n   ❌ ПРОБЛЕМА: Цены в период execution НЕ найдены в БД!`);
    console.log(`   ⚠️  Цены НЕ сохраняются!`);
    
    // Проверяем последние цены вообще
    const lastPrices = await sql`
      SELECT 
        cp.created_at,
        COUNT(*) as count
      FROM car_prices cp
      GROUP BY cp.created_at
      ORDER BY cp.created_at DESC
      LIMIT 5
    `;
    
    if (lastPrices.length > 0) {
      console.log(`\n   Последние сохранения цен в БД:`);
      lastPrices.forEach(p => {
        console.log(`      ${p.created_at}: ${p.count} цен`);
      });
    } else {
      console.log(`\n   ⚠️  В БД вообще нет цен!`);
    }
  }
  
  // 2. Проверяем машины, обновленные в период execution
  console.log('\n\n2️⃣ Проверка машин в БД за период execution...\n');
  
  const carsInDB = await sql`
    SELECT 
      c.id,
      c.rentprog_id,
      c.car_name,
      c.code,
      c.number,
      c.deposit,
      c.price_hour,
      c.hourly_deposit,
      c.monthly_deposit,
      c.updated_at
    FROM cars c
    WHERE c.updated_at >= ${executionStart}
      AND c.updated_at <= ${executionEnd}
    ORDER BY c.updated_at DESC
    LIMIT 20
  `;
  
  console.log(`   📊 Машин обновлено в период execution: ${carsInDB.length}`);
  
  if (carsInDB.length > 0) {
    console.log(`\n   Примеры обновленных машин:`);
    carsInDB.slice(0, 10).forEach((car, idx) => {
      console.log(`\n   ${idx + 1}. ${car.car_name || car.code || car.number || car.rentprog_id}`);
      console.log(`      Deposit: ${car.deposit || 0}`);
      console.log(`      Price/hour: ${car.price_hour || 0}`);
      console.log(`      Hourly deposit: ${car.hourly_deposit || 0}`);
      console.log(`      Monthly deposit: ${car.monthly_deposit || 0}`);
      console.log(`      Обновлено: ${car.updated_at}`);
    });
    
    // Проверяем на затирание пустыми значениями
    const emptyDeposit = carsInDB.filter(c => !c.deposit || c.deposit === 0);
    const emptyPriceHour = carsInDB.filter(c => !c.price_hour || c.price_hour === 0);
    const emptyHourlyDeposit = carsInDB.filter(c => !c.hourly_deposit || c.hourly_deposit === 0);
    const emptyMonthlyDeposit = carsInDB.filter(c => !c.monthly_deposit || c.monthly_deposit === 0);
    
    console.log(`\n   📊 Статистика по пустым значениям:`);
    console.log(`      - Deposit пустой: ${emptyDeposit.length} из ${carsInDB.length}`);
    console.log(`      - Price/hour пустой: ${emptyPriceHour.length} из ${carsInDB.length}`);
    console.log(`      - Hourly deposit пустой: ${emptyHourlyDeposit.length} из ${carsInDB.length}`);
    console.log(`      - Monthly deposit пустой: ${emptyMonthlyDeposit.length} из ${carsInDB.length}`);
    
    if (emptyDeposit.length > 0 || emptyPriceHour.length > 0) {
      console.log(`\n   ⚠️  ВНИМАНИЕ: Найдены машины с пустыми значениями!`);
      console.log(`      ⚠️  Возможно затирание пустыми значениями!`);
      
      if (emptyDeposit.length > 0) {
        console.log(`\n   Машины с пустым deposit:`);
        emptyDeposit.slice(0, 5).forEach(c => {
          console.log(`      - ${c.car_name || c.code || c.rentprog_id} (обновлено: ${c.updated_at})`);
        });
      }
      
      if (emptyPriceHour.length > 0) {
        console.log(`\n   Машины с пустым price_hour:`);
        emptyPriceHour.slice(0, 5).forEach(c => {
          console.log(`      - ${c.car_name || c.code || c.rentprog_id} (обновлено: ${c.updated_at})`);
        });
      }
    } else {
      console.log(`\n   ✅ Все машины имеют непустые значения!`);
      console.log(`   ✅ Затирание пустыми значениями НЕ обнаружено!`);
    }
  } else {
    console.log(`\n   ⚠️  Машины в период execution НЕ найдены в БД!`);
  }
  
  // 3. Проверяем защиту от пустых значений в ценах
  console.log('\n\n3️⃣ Проверка защиты от пустых значений в ценах...\n');
  
  const emptyPrices = await sql`
    SELECT 
      cp.id,
      cp.car_id,
      cp.rentprog_price_id,
      cp.season_id,
      cp.price_values,
      cp.created_at,
      c.rentprog_id as car_rentprog_id
    FROM car_prices cp
    JOIN cars c ON c.id = cp.car_id
    WHERE cp.created_at >= ${executionStart}
      AND cp.created_at <= ${executionEnd}
      AND (
        cp.rentprog_price_id IS NULL 
        OR cp.rentprog_price_id = ''
        OR cp.season_id IS NULL
        OR cp.price_values IS NULL
        OR (cp.price_values::jsonb->>'values')::jsonb IS NULL
        OR jsonb_array_length((cp.price_values::jsonb->>'values')::jsonb) = 0
      )
    LIMIT 10
  `;
  
  if (emptyPrices.length > 0) {
    console.log(`   ⚠️  ВНИМАНИЕ: Найдено ${emptyPrices.length} цен с пустыми значениями!`);
    console.log(`      ⚠️  Защита от пустых значений НЕ сработала!`);
    emptyPrices.forEach((price, idx) => {
      console.log(`\n   ${idx + 1}. Car ID: ${price.car_rentprog_id}`);
      console.log(`      Price ID: ${price.rentprog_price_id || 'NULL'}`);
      console.log(`      Season ID: ${price.season_id || 'NULL'}`);
      console.log(`      Price values: ${price.price_values ? 'есть' : 'NULL'}`);
    });
  } else {
    console.log(`   ✅ Защита от пустых значений работает!`);
    console.log(`      Все сохраненные цены имеют валидные значения`);
  }
  
  // 4. Проверяем данные на входе (из API)
  console.log('\n\n4️⃣ Анализ данных на входе (из API)...\n');
  
  // Проверяем последние обновленные машины и их данные
  const recentCarsWithData = await sql`
    SELECT 
      c.rentprog_id,
      c.car_name,
      c.code,
      c.deposit,
      c.price_hour,
      c.data->'prices' as prices_in_data,
      c.updated_at
    FROM cars c
    WHERE c.updated_at >= ${executionStart}
      AND c.updated_at <= ${executionEnd}
    ORDER BY c.updated_at DESC
    LIMIT 5
  `;
  
  if (recentCarsWithData.length > 0) {
    console.log(`   Проверка данных на входе (из cars.data):`);
    recentCarsWithData.forEach((car, idx) => {
      console.log(`\n   ${idx + 1}. ${car.car_name || car.code || car.rentprog_id}`);
      console.log(`      Deposit в БД: ${car.deposit || 0}`);
      console.log(`      Price/hour в БД: ${car.price_hour || 0}`);
      console.log(`      Prices в data: ${car.prices_in_data ? 'есть' : 'нет'}`);
      
      if (car.prices_in_data && Array.isArray(car.prices_in_data)) {
        console.log(`      Количество цен в data: ${car.prices_in_data.length}`);
      }
    });
  }
  
  // 5. Итоговый вывод
  console.log('\n\n5️⃣ ИТОГОВЫЙ ВЫВОД...\n');
  
  if (pricesInDB.length === 0) {
    console.log('   ❌ КРИТИЧЕСКАЯ ПРОБЛЕМА: Цены НЕ сохраняются в БД!');
    console.log('   ⚠️  Нужно проверить:');
    console.log('      1. Извлекаются ли цены в ноде "Normalize Cars"');
    console.log('      2. Проходят ли цены через "Split Cars and Prices"');
    console.log('      3. Находятся ли car_id в ноде "Find Car ID"');
    console.log('      4. Сохраняются ли цены в ноде "Save Prices"');
  } else {
    console.log(`   ✅ Цены сохраняются в БД! (${pricesInDB.length} цен)`);
  }
  
  if (carsInDB.length > 0) {
    const hasEmpty = carsInDB.some(c => (!c.deposit || c.deposit === 0) || (!c.price_hour || c.price_hour === 0));
    if (hasEmpty) {
      console.log('   ⚠️  ВНИМАНИЕ: Некоторые машины имеют пустые значения!');
      console.log('   ⚠️  Возможно затирание пустыми значениями!');
    } else {
      console.log('   ✅ Все машины имеют непустые значения!');
      console.log('   ✅ Затирание пустыми значениями НЕ обнаружено!');
    }
  }
  
  console.log('\n✅ Проверка завершена!\n');
  
  await sql.end();
}

checkExecution27779()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });

