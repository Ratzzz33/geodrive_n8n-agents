#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkPricesSystem() {
  const sql = postgres(CONNECTION_STRING, {max: 1, ssl: {rejectUnauthorized: false}});
  
  console.log('\n🔍 ПРОВЕРКА СИСТЕМЫ ЦЕН НА СЕЗОНЫ\n');
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    // 1. Проверка существования таблицы car_prices
    console.log('1️⃣  Проверка таблицы car_prices...\n');
    
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'car_prices'
      )
    `.then(rows => rows[0].exists);
    
    if (!tableExists) {
      console.log('❌ Таблица car_prices НЕ СУЩЕСТВУЕТ!');
      console.log('\n💡 Необходимо выполнить миграцию:');
      console.log('   node setup/run_migration_004.mjs\n');
      await sql.end();
      return;
    }
    
    console.log('✅ Таблица car_prices существует\n');
    
    // 2. Структура таблицы
    const columns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'car_prices'
      ORDER BY ordinal_position
    `;
    
    console.log('📊 Структура таблицы:');
    columns.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type}`);
    });
    console.log();
    
    // 3. Статистика данных
    console.log('2️⃣  Статистика данных...\n');
    
    const stats = await sql`
      SELECT 
        COUNT(*) as total_prices,
        COUNT(DISTINCT car_id) as cars_with_prices,
        COUNT(DISTINCT season_id) as unique_seasons
      FROM car_prices
    `.then(rows => rows[0]);
    
    console.log(`Всего записей цен: ${stats.total_prices}`);
    console.log(`Машин с ценами: ${stats.cars_with_prices}`);
    console.log(`Уникальных сезонов: ${stats.unique_seasons}\n`);
    
    // 4. Проверка триггера
    console.log('3️⃣  Проверка триггера cars_sync_prices_from_data...\n');
    
    const triggerExists = await sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trg_cars_sync_prices_from_data'
      )
    `.then(rows => rows[0].exists);
    
    if (!triggerExists) {
      console.log('❌ Триггер НЕ СУЩЕСТВУЕТ!');
      console.log('\n💡 Необходимо выполнить миграцию:');
      console.log('   node setup/run_migration_004.mjs\n');
    } else {
      console.log('✅ Триггер существует\n');
      
      // Получить определение триггера
      const triggerDef = await sql`
        SELECT 
          tgname,
          tgtype,
          tgenabled,
          pg_get_triggerdef(oid) as definition
        FROM pg_trigger
        WHERE tgname = 'trg_cars_sync_prices_from_data'
      `.then(rows => rows[0]);
      
      console.log(`   Тип: ${triggerDef.tgtype === 5 ? 'AFTER' : 'BEFORE'} INSERT OR UPDATE`);
      console.log(`   Активен: ${triggerDef.tgenabled === 'O' ? 'Да' : 'Нет'}\n`);
    }
    
    // 5. Проверка данных в cars.data с prices
    console.log('4️⃣  Проверка данных prices в cars.data...\n');
    
    const carsWithPricesData = await sql`
      SELECT COUNT(*) as count
      FROM cars
      WHERE data ? 'prices'
        AND jsonb_array_length(data->'prices') > 0
    `.then(rows => rows[0]);
    
    console.log(`Машин с данными prices в data: ${carsWithPricesData.count}\n`);
    
    if (parseInt(carsWithPricesData.count) === 0) {
      console.log('⚠️  ПРОБЛЕМА: Нет машин с данными prices в поле data!');
      console.log('\n📋 Возможные причины:');
      console.log('   1. Машины не были полностью загружены из RentProg API');
      console.log('   2. При upsert не сохраняется поле "prices"');
      console.log('   3. dynamic_upsert_entity очищает data сразу после вставки\n');
      
      // Проверить пример машины
      const sampleCar = await sql`
        SELECT 
          c.id,
          c.model,
          c.brand,
          jsonb_object_keys(c.data) as data_keys
        FROM cars c
        LIMIT 1
      `.then(rows => rows[0]);
      
      if (sampleCar) {
        console.log('📊 Пример машины:');
        console.log(`   ID: ${sampleCar.id}`);
        console.log(`   Модель: ${sampleCar.brand} ${sampleCar.model}`);
        console.log(`   Ключи в data: ${sampleCar.data_keys || 'пусто'}\n`);
      }
    } else {
      // Показать пример
      const example = await sql`
        SELECT 
          c.id,
          c.model,
          c.brand,
          jsonb_array_length(c.data->'prices') as prices_count,
          (c.data->'prices'->0) as first_price
        FROM cars c
        WHERE data ? 'prices'
          AND jsonb_array_length(c.data->'prices') > 0
        LIMIT 1
      `.then(rows => rows[0]);
      
      if (example) {
        console.log('✅ Пример машины с ценами:');
        console.log(`   ID: ${example.id}`);
        console.log(`   Модель: ${example.brand} ${example.model}`);
        console.log(`   Количество prices: ${example.prices_count}`);
        console.log(`   Пример первой цены:\n`);
        console.log('   ' + JSON.stringify(example.first_price, null, 2).split('\n').join('\n   '));
        console.log();
      }
    }
    
    // 6. Сравнение: data vs car_prices
    console.log('5️⃣  Сравнение: cars.data vs car_prices...\n');
    
    const totalCars = await sql`SELECT COUNT(*) as count FROM cars`.then(rows => rows[0].count);
    const carsInPricesTable = parseInt(stats.cars_with_prices);
    const carsWithPricesInData = parseInt(carsWithPricesData.count);
    
    console.log(`Всего машин в БД: ${totalCars}`);
    console.log(`Машин в car_prices: ${carsInPricesTable}`);
    console.log(`Машин с prices в data: ${carsWithPricesInData}\n`);
    
    if (carsWithPricesInData > carsInPricesTable) {
      console.log('⚠️  РАСХОЖДЕНИЕ!');
      console.log(`   ${carsWithPricesInData - carsInPricesTable} машин имеют prices в data,`);
      console.log(`   но НЕ имеют записей в car_prices\n`);
      console.log('💡 Решение: Запустить backfill');
      console.log('   node setup/backfill_car_prices.mjs\n');
    } else if (carsInPricesTable > carsWithPricesInData) {
      console.log('✅ Триггер работает правильно!');
      console.log('   (Больше записей в car_prices, чем в data -');
      console.log('    значит data очищается после обработки)\n');
    } else if (carsInPricesTable === 0 && carsWithPricesInData === 0) {
      console.log('❌ ПРОБЛЕМА: Цены вообще не загружаются!');
      console.log('\n📋 Возможные причины:');
      console.log('   1. RentProg API не возвращает поле "prices"');
      console.log('   2. При upsert машин поле "prices" не сохраняется');
      console.log('   3. Машины не были загружены полностью (только из вебхуков)\n');
      console.log('💡 Решение: Запустить полную синхронизацию машин');
      console.log('   node setup/sync_all_cars.mjs\n');
    } else {
      console.log('✅ Всё синхронизировано!\n');
    }
    
    // 7. Проверка dynamic_upsert_entity
    console.log('6️⃣  Проверка функции dynamic_upsert_entity...\n');
    
    const functionDef = await sql`
      SELECT pg_get_functiondef('dynamic_upsert_entity'::regproc)
    `.then(rows => rows[0]?.pg_get_functiondef);
    
    if (functionDef) {
      // Проверить, очищает ли функция data
      const clearsData = functionDef.includes('data = $1') || functionDef.includes('UPDATE');
      
      if (clearsData && functionDef.includes('INSERT INTO')) {
        console.log('⚠️  dynamic_upsert_entity вставляет данные в cars.data');
        console.log('   Триггер должен сработать ПЕРЕД очисткой data\n');
      }
      
      // Проверить стратегию обновления data
      if (functionDef.toLowerCase().includes('data = $1::jsonb')) {
        console.log('✅ Функция перезаписывает data полностью');
        console.log('   Триггер сработает при каждом update\n');
      }
    }
    
    // ИТОГОВЫЙ ВЕРДИКТ
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 ИТОГОВЫЙ ВЕРДИКТ');
    console.log('═══════════════════════════════════════════════════════\n');
    
    if (parseInt(stats.total_prices) === 0) {
      console.log('❌ ЦЕНЫ НЕ ПОДТЯГИВАЮТСЯ!\n');
      console.log('📋 Причины:');
      console.log('   1. Машины загружаются только из вебхуков (частичные данные)');
      console.log('   2. В вебхуках нет поля "prices" - оно есть только при полном fetch');
      console.log('   3. Нужна полная синхронизация машин через RentProg API\n');
      console.log('✅ РЕШЕНИЕ:');
      console.log('   node setup/sync_all_cars_with_prices.mjs\n');
    } else {
      console.log('✅ Система работает!\n');
      console.log(`   Загружено цен для ${stats.cars_with_prices} машин\n`);
    }
    
  } finally {
    await sql.end();
  }
}

checkPricesSystem();

