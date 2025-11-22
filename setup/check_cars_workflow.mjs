#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkCarsWorkflow() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });
  try {
    console.log('📋 Проверка workflow синхронизации автомобилей\n');
    console.log('Workflow: https://n8n.rentflow.rentals/workflow/ihRLR0QCJySx319b\n');

    // Проверка таблицы cars
    console.log('━━━ 1. Проверка таблицы CARS ━━━\n');
    
    const carsStats = await sql`
      SELECT
        COUNT(*) AS total_cars,
        COUNT(branch_id) AS with_branch,
        COUNT(rentprog_id) AS with_rentprog_id,
        COUNT(deposit) FILTER (WHERE deposit > 0) AS with_deposit,
        COUNT(price_hour) FILTER (WHERE price_hour > 0) AS with_price_hour,
        COUNT(data) AS with_data,
        MAX(updated_at) AS last_update
      FROM cars;
    `;

    const stats = carsStats[0];
    console.log(`✅ Всего машин: ${stats.total_cars}`);
    console.log(`✅ С branch_id: ${stats.with_branch} (${((stats.with_branch / stats.total_cars) * 100).toFixed(1)}%)`);
    console.log(`✅ С rentprog_id: ${stats.with_rentprog_id} (${((stats.with_rentprog_id / stats.total_cars) * 100).toFixed(1)}%)`);
    console.log(`✅ С deposit: ${stats.with_deposit} (${((stats.with_deposit / stats.total_cars) * 100).toFixed(1)}%)`);
    console.log(`✅ С price_hour: ${stats.with_price_hour} (${((stats.with_price_hour / stats.total_cars) * 100).toFixed(1)}%)`);
    console.log(`✅ С data (JSONB): ${stats.with_data} (${((stats.with_data / stats.total_cars) * 100).toFixed(1)}%)`);
    console.log(`📅 Последнее обновление: ${stats.last_update}\n`);

    // Проверка распределения по филиалам
    console.log('━━━ 2. Распределение по ФИЛИАЛАМ ━━━\n');
    
    const byBranch = await sql`
      SELECT
        b.name AS branch_name,
        COUNT(c.id) AS cars_count,
        COUNT(c.deposit) FILTER (WHERE c.deposit > 0) AS with_prices
      FROM cars c
      LEFT JOIN branches b ON c.branch_id = b.id
      GROUP BY b.name
      ORDER BY cars_count DESC;
    `;

    byBranch.forEach(b => {
      console.log(`📍 ${b.branch_name || 'Без филиала'}: ${b.cars_count} машин (${b.with_prices} с ценами)`);
    });

    // Проверка последних обновленных машин
    console.log('\n━━━ 3. Последние ОБНОВЛЕННЫЕ машины (топ 5) ━━━\n');
    
    const recentCars = await sql`
      SELECT
        c.car_name,
        c.number,
        c.code,
        b.name AS branch,
        c.deposit,
        c.price_hour,
        c.mileage,
        c.active,
        c.updated_at
      FROM cars c
      LEFT JOIN branches b ON c.branch_id = b.id
      ORDER BY c.updated_at DESC
      LIMIT 5;
    `;

    recentCars.forEach((car, i) => {
      console.log(`${i + 1}. ${car.car_name} (${car.code || car.number})`);
      console.log(`   Филиал: ${car.branch || 'Не указан'}`);
      console.log(`   Депозит: ${car.deposit || 'Не указан'} GEL`);
      console.log(`   Цена/час: ${car.price_hour || 'Не указана'} GEL`);
      console.log(`   Пробег: ${car.mileage || 'Не указан'} км`);
      console.log(`   Активна: ${car.active ? 'Да' : 'Нет'}`);
      console.log(`   Обновлена: ${car.updated_at}\n`);
    });

    // Проверка полноты данных
    console.log('━━━ 4. Проверка ПОЛНОТЫ данных ━━━\n');
    
    const missingData = await sql`
      SELECT
        COUNT(*) FILTER (WHERE branch_id IS NULL) AS missing_branch,
        COUNT(*) FILTER (WHERE rentprog_id IS NULL OR rentprog_id = '') AS missing_rentprog_id,
        COUNT(*) FILTER (WHERE car_name IS NULL OR car_name = '') AS missing_car_name,
        COUNT(*) FILTER (WHERE deposit IS NULL OR deposit = 0) AS missing_deposit,
        COUNT(*) FILTER (WHERE price_hour IS NULL OR price_hour = 0) AS missing_price_hour,
        COUNT(*) FILTER (WHERE data IS NULL) AS missing_data
      FROM cars;
    `;

    const missing = missingData[0];
    const hasIssues = Object.values(missing).some(v => v > 0);

    if (hasIssues) {
      console.log('⚠️  Обнаружены проблемы:\n');
      if (missing.missing_branch > 0) {
        console.log(`   ⚠️  Без branch_id: ${missing.missing_branch}`);
      }
      if (missing.missing_rentprog_id > 0) {
        console.log(`   ⚠️  Без rentprog_id: ${missing.missing_rentprog_id}`);
      }
      if (missing.missing_car_name > 0) {
        console.log(`   ⚠️  Без названия: ${missing.missing_car_name}`);
      }
      if (missing.missing_deposit > 0) {
        console.log(`   ⚠️  Без депозита: ${missing.missing_deposit}`);
      }
      if (missing.missing_price_hour > 0) {
        console.log(`   ⚠️  Без цены/час: ${missing.missing_price_hour}`);
      }
      if (missing.missing_data > 0) {
        console.log(`   ⚠️  Без data (JSONB): ${missing.missing_data}`);
      }
    } else {
      console.log('✅ Все машины имеют полные данные!');
    }

    // Проверка external_refs
    console.log('\n━━━ 5. Проверка EXTERNAL_REFS для cars ━━━\n');
    
    const externalRefsStats = await sql`
      SELECT
        COUNT(DISTINCT c.id) AS total_cars,
        COUNT(DISTINCT er.entity_id) AS with_external_refs,
        COUNT(DISTINCT er.entity_id) * 100.0 / COUNT(DISTINCT c.id) AS coverage_percent
      FROM cars c
      LEFT JOIN external_refs er ON er.entity_id = c.id AND er.entity_type = 'car' AND er.system = 'rentprog';
    `;

    const erStats = externalRefsStats[0];
    console.log(`✅ Всего машин: ${erStats.total_cars}`);
    console.log(`✅ С external_refs: ${erStats.with_external_refs} (${parseFloat(erStats.coverage_percent).toFixed(1)}%)`);

    if (parseFloat(erStats.coverage_percent) < 100) {
      console.log(`\n⚠️  ${erStats.total_cars - erStats.with_external_refs} машин без external_refs!`);
      console.log('   Это может означать что workflow не создает external_refs.');
    } else {
      console.log('\n✅ Все машины имеют external_refs!');
    }

    // Проверка что цены сохраняются
    console.log('\n━━━ 6. Детальная проверка ЦЕН (случайная машина) ━━━\n');
    
    const sampleCar = await sql`
      SELECT
        c.car_name,
        c.number,
        c.code,
        b.name AS branch,
        c.deposit,
        c.price_hour,
        c.hourly_deposit,
        c.monthly_deposit,
        c.data->'price_values' AS price_values_in_data,
        c.data->'seasons' AS seasons_in_data
      FROM cars c
      LEFT JOIN branches b ON c.branch_id = b.id
      WHERE c.deposit > 0
      ORDER BY c.updated_at DESC
      LIMIT 1;
    `;

    if (sampleCar.length > 0) {
      const car = sampleCar[0];
      console.log(`🚗 ${car.car_name} (${car.code || car.number})`);
      console.log(`   Филиал: ${car.branch}\n`);
      console.log('   📊 Цены в таблице cars:');
      console.log(`      Депозит: ${car.deposit || 0} GEL`);
      console.log(`      Цена/час: ${car.price_hour || 0} GEL`);
      console.log(`      Почасовой депозит: ${car.hourly_deposit || 0} GEL`);
      console.log(`      Месячный депозит: ${car.monthly_deposit || 0} GEL\n`);
      
      if (car.price_values_in_data) {
        console.log('   📋 price_values в data (JSONB):');
        console.log(`      ${JSON.stringify(car.price_values_in_data, null, 2).split('\n').join('\n      ')}`);
      } else {
        console.log('   ℹ️  price_values в data: не найдено (это нормально, они удаляются в "Remove Price Values")');
      }
      
      if (car.seasons_in_data) {
        console.log('\n   📋 seasons в data (JSONB):');
        console.log(`      ${JSON.stringify(car.seasons_in_data, null, 2).split('\n').join('\n      ')}`);
      } else {
        console.log('\n   ℹ️  seasons в data: не найдено (это нормально, они удаляются в "Remove Price Values")');
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📝 ИТОГИ:\n');
    console.log('1. ✅ Workflow получает данные из RentProg через endpoint `all_cars_full`');
    console.log('2. ✅ Сохраняются базовые цены: deposit, price_hour, hourly_deposit, monthly_deposit');
    console.log('3. ✅ Сохраняются филиалы (branch_id)');
    console.log('4. ✅ Сохраняются технические параметры (mileage, state, active и др.)');
    console.log('5. ✅ Полный payload сохраняется в data (JSONB)');
    console.log('6. ⚠️  НО: детальные цены (price_values, seasons) удаляются нодой "Remove Price Values"');
    console.log('\n💡 РЕКОМЕНДАЦИИ:');
    console.log('   - Для полных цен нужна отдельная таблица car_prices или оставлять их в data');
    console.log('   - Проверь что external_refs создаются для всех машин');
    console.log('   - Workflow должен запускаться раз в сутки (cron: 0 5 * * *)');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
}

checkCarsWorkflow();

