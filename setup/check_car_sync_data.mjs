#!/usr/bin/env node
/**
 * Проверка данных после синхронизации машин
 */
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkCarSyncData() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });
  
  try {
    console.log('🔍 Проверка данных после execution 25647\n');

    // 1. Проверка таблицы rentprog_car_states_snapshot
    console.log('━━━ 1. Проверка rentprog_car_states_snapshot ━━━\n');
    
    const snapshotSample = await sql`
      SELECT 
        rentprog_id,
        car_name,
        state,
        pg_typeof(state) as state_type,
        deposit,
        price_hour,
        mileage,
        jsonb_typeof(data) as data_type,
        (data IS NOT NULL AND jsonb_typeof(data) = 'object' AND data <> '{}'::jsonb) as data_has_keys
      FROM rentprog_car_states_snapshot
      ORDER BY rentprog_id
      LIMIT 3;
    `;

    console.log('📊 Примеры из snapshot таблицы:\n');
    snapshotSample.forEach((row, i) => {
      console.log(`${i + 1}. ${row.car_name} (${row.rentprog_id})`);
      console.log(`   state: "${row.state}" (тип: ${row.state_type})`);
      console.log(`   deposit: ${row.deposit}, price_hour: ${row.price_hour}, mileage: ${row.mileage}`);
      console.log(`   data тип: ${row.data_type}, есть ключи: ${row.data_has_keys}`);
      console.log('');
    });

    // 2. Проверка что state сохранен как text (не integer)
    const stateCheck = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN state IS NOT NULL THEN 1 END) as with_state,
        COUNT(CASE WHEN state ~ '^[0-9]+$' THEN 1 END) as numeric_state,
        COUNT(CASE WHEN state NOT SIMILAR TO '[0-9]+' AND state IS NOT NULL THEN 1 END) as text_state
      FROM rentprog_car_states_snapshot;
    `;

    console.log('━━━ 2. Проверка типа поля state ━━━\n');
    const sc = stateCheck[0];
    console.log(`Всего записей: ${sc.total}`);
    console.log(`С state: ${sc.with_state}`);
    console.log(`State как число (строка): ${sc.numeric_state}`);
    console.log(`State как текст: ${sc.text_state}`);
    console.log('');

    // 3. Проверка data JSONB
    const dataCheck = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN data IS NOT NULL AND jsonb_typeof(data) = 'object' THEN 1 END) as with_data_object,
        COUNT(CASE WHEN data ? 'id' THEN 1 END) as data_has_id,
        COUNT(CASE WHEN data ? 'car_name' THEN 1 END) as data_has_car_name,
        COUNT(CASE WHEN data ? 'deposit' THEN 1 END) as data_has_deposit
      FROM rentprog_car_states_snapshot;
    `;

    console.log('━━━ 3. Проверка data JSONB ━━━\n');
    const dc = dataCheck[0];
    console.log(`Всего записей: ${dc.total}`);
    console.log(`С data (object): ${dc.with_data_object} (${((dc.with_data_object / dc.total) * 100).toFixed(1)}%)`);
    console.log(`Data содержит 'id': ${dc.data_has_id}`);
    console.log(`Data содержит 'car_name': ${dc.data_has_car_name}`);
    console.log(`Data содержит 'deposit': ${dc.data_has_deposit}`);
    console.log('');

    // 4. Проверка таблицы cars - COALESCE не затирает данные
    console.log('━━━ 4. Проверка таблицы cars (COALESCE) ━━━\n');
    
    // Получаем случайную машину с существующими данными
    const carWithData = await sql`
      SELECT 
        rentprog_id,
        car_name,
        deposit,
        price_hour,
        mileage,
        state,
        branch_id,
        jsonb_typeof(data) as data_type,
        updated_at
      FROM cars
      WHERE deposit IS NOT NULL 
        AND price_hour IS NOT NULL
        AND mileage IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 3;
    `;

    console.log('📊 Примеры машин из cars:\n');
    carWithData.forEach((row, i) => {
      console.log(`${i + 1}. ${row.car_name} (${row.rentprog_id})`);
      console.log(`   deposit: ${row.deposit}, price_hour: ${row.price_hour}`);
      console.log(`   mileage: ${row.mileage}, state: ${row.state}`);
      console.log(`   branch_id: ${row.branch_id ? 'есть' : 'НЕТ ❌'}`);
      console.log(`   data тип: ${row.data_type}`);
      console.log(`   обновлено: ${row.updated_at}`);
      console.log('');
    });

    // 5. Проверка что NULL значения не затирают существующие
    const nullCheck = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN deposit IS NULL THEN 1 END) as null_deposit,
        COUNT(CASE WHEN price_hour IS NULL THEN 1 END) as null_price_hour,
        COUNT(CASE WHEN mileage IS NULL THEN 1 END) as null_mileage,
        COUNT(CASE WHEN branch_id IS NULL THEN 1 END) as null_branch_id,
        COUNT(CASE WHEN data IS NULL OR jsonb_typeof(data) = 'null' THEN 1 END) as null_data
      FROM cars
      WHERE updated_at > NOW() - INTERVAL '1 hour';
    `;

    console.log('━━━ 5. Проверка NULL значений (последний час) ━━━\n');
    const nc = nullCheck[0];
    console.log(`Обновлено машин: ${nc.total}`);
    console.log(`NULL deposit: ${nc.null_deposit} (${((nc.null_deposit / nc.total) * 100).toFixed(1)}%)`);
    console.log(`NULL price_hour: ${nc.null_price_hour} (${((nc.null_price_hour / nc.total) * 100).toFixed(1)}%)`);
    console.log(`NULL mileage: ${nc.null_mileage} (${((nc.null_mileage / nc.total) * 100).toFixed(1)}%)`);
    console.log(`NULL branch_id: ${nc.null_branch_id} (${((nc.null_branch_id / nc.total) * 100).toFixed(1)}%)`);
    console.log(`NULL data: ${nc.null_data} (${((nc.null_data / nc.total) * 100).toFixed(1)}%)`);
    console.log('');

    // 6. Итоговая проверка
    console.log('━━━ 6. ИТОГОВАЯ ПРОВЕРКА ━━━\n');
    
    const issues = [];
    
    if (sc.with_state === 0) {
      issues.push('❌ Нет ни одного state в snapshot');
    } else {
      console.log('✅ State сохраняется в snapshot');
    }
    
    if (dc.with_data_object < dc.total * 0.9) {
      issues.push(`⚠️  Только ${((dc.with_data_object / dc.total) * 100).toFixed(1)}% записей snapshot имеют data`);
    } else {
      console.log('✅ Data JSONB заполнен в snapshot');
    }
    
    if (nc.null_deposit > nc.total * 0.5) {
      issues.push(`⚠️  Много NULL deposit в cars: ${((nc.null_deposit / nc.total) * 100).toFixed(1)}%`);
    } else {
      console.log('✅ COALESCE корректно сохраняет deposit');
    }
    
    if (nc.null_branch_id > nc.total * 0.1) {
      issues.push(`⚠️  Есть NULL branch_id в cars: ${((nc.null_branch_id / nc.total) * 100).toFixed(1)}%`);
    } else {
      console.log('✅ branch_id заполнен');
    }
    
    if (nc.null_data > nc.total * 0.1) {
      issues.push(`⚠️  Есть NULL data в cars: ${((nc.null_data / nc.total) * 100).toFixed(1)}%`);
    } else {
      console.log('✅ data JSONB заполнен в cars');
    }

    // 7. Проверка car_prices
    console.log('━━━ 7. Проверка car_prices ━━━\n');
    
    const pricesCheck = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT car_id) as cars_with_prices,
        COUNT(CASE WHEN price_values IS NOT NULL AND jsonb_typeof(price_values) = 'array' THEN 1 END) as valid_prices
      FROM car_prices;
    `;
    
    const pc = pricesCheck[0];
    console.log(`Всего записей цен: ${pc.total}`);
    console.log(`Машин с ценами: ${pc.cars_with_prices}`);
    console.log(`Валидных массивов цен (JSONB): ${pc.valid_prices}`);
    
    if (pc.total > 0) {
        console.log('✅ Цены сохраняются в car_prices');
    } else {
        issues.push('⚠️  Таблица car_prices пуста (возможно, prices еще не пришли)');
    }
    
    if (issues.length > 0) {
      console.log('\n⚠️  Обнаружены проблемы:\n');
      issues.forEach(issue => console.log(`   ${issue}`));
    } else {
      console.log('\n🎉 Все проверки пройдены! Данные сохраняются корректно.');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkCarSyncData();

