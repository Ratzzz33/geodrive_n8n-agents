#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkCarPricesInData() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Проверка цен в поле data (JSONB)\n');

    // Проверяем последние обновленные машины с ценами
    const carsWithPrices = await sql`
      SELECT
        c.car_name,
        c.code,
        c.number,
        b.name AS branch,
        c.deposit,
        c.price_hour,
        c.hourly_deposit,
        c.monthly_deposit,
        c.data,
        c.updated_at
      FROM cars c
      LEFT JOIN branches b ON c.branch_id = b.id
      WHERE c.deposit > 0
      ORDER BY c.updated_at DESC
      LIMIT 3;
    `;

    console.log('━━━ Последние 3 машины с ценами ━━━\n');

    carsWithPrices.forEach((car, i) => {
      console.log(`${i + 1}. ${car.car_name} (${car.code || car.number})`);
      console.log(`   Филиал: ${car.branch}`);
      console.log(`   Обновлена: ${car.updated_at}\n`);

      console.log('   📊 Цены в основных полях:');
      console.log(`      deposit: ${car.deposit || 'NULL'}`);
      console.log(`      price_hour: ${car.price_hour || 'NULL'}`);
      console.log(`      hourly_deposit: ${car.hourly_deposit || 'NULL'}`);
      console.log(`      monthly_deposit: ${car.monthly_deposit || 'NULL'}\n`);

      if (car.data && typeof car.data === 'object') {
        console.log('   📋 Что есть в data (JSONB):');
        console.log(`      deposit: ${car.data.deposit !== undefined ? car.data.deposit : 'НЕТ'}`);
        console.log(`      price_hour: ${car.data.price_hour !== undefined ? car.data.price_hour : 'НЕТ'}`);
        console.log(`      hourly_deposit: ${car.data.hourly_deposit !== undefined ? car.data.hourly_deposit : 'НЕТ'}`);
        console.log(`      monthly_deposit: ${car.data.monthly_deposit !== undefined ? car.data.monthly_deposit : 'НЕТ'}`);
        
        // Проверяем наличие детальных цен
        console.log(`\n      price_values: ${car.data.price_values !== undefined ? 'ЕСТЬ ✅' : 'НЕТ ❌'}`);
        console.log(`      seasons: ${car.data.seasons !== undefined ? 'ЕСТЬ ✅' : 'НЕТ ❌'}`);
        console.log(`      price_periods: ${car.data.price_periods !== undefined ? 'ЕСТЬ ✅' : 'НЕТ ❌'}`);
        
        // Если есть price_values - показываем их
        if (car.data.price_values) {
          console.log('\n      📈 price_values содержимое:');
          if (typeof car.data.price_values === 'object') {
            console.log(`         ${JSON.stringify(car.data.price_values, null, 2).split('\n').join('\n         ')}`);
          } else {
            console.log(`         ${car.data.price_values}`);
          }
        }
        
        // Если есть seasons - показываем их
        if (car.data.seasons) {
          console.log('\n      📅 seasons содержимое:');
          if (Array.isArray(car.data.seasons)) {
            console.log(`         Количество сезонов: ${car.data.seasons.length}`);
            car.data.seasons.slice(0, 2).forEach((season, idx) => {
              console.log(`         Сезон ${idx + 1}: ${JSON.stringify(season)}`);
            });
          } else {
            console.log(`         ${car.data.seasons}`);
          }
        }

        // Проверяем все ключи в data
        const allKeys = Object.keys(car.data);
        const priceRelatedKeys = allKeys.filter(k => 
          k.includes('price') || 
          k.includes('deposit') || 
          k.includes('season') || 
          k.includes('cost')
        );
        
        console.log(`\n      🔑 Все ключи связанные с ценами в data:`);
        console.log(`         ${priceRelatedKeys.join(', ') || 'Нет'}`);
        
        console.log(`\n      📝 Всего полей в data: ${allKeys.length}`);
      } else {
        console.log('   ⚠️  data = NULL или не объект');
      }
      
      console.log('\n' + '─'.repeat(80) + '\n');
    });

    // Проверяем есть ли машины с пустыми ценами в БД но с данными в data
    console.log('━━━ Проверка машин с пустыми ценами но непустым data ━━━\n');
    
    const carsWithEmptyPrices = await sql`
      SELECT
        c.car_name,
        c.code,
        c.deposit,
        c.price_hour,
        c.data->'deposit' AS data_deposit,
        c.data->'price_hour' AS data_price_hour,
        jsonb_typeof(c.data) AS data_type,
        jsonb_object_keys(c.data) AS data_keys_sample
      FROM cars c
      WHERE (c.deposit IS NULL OR c.deposit = 0)
        AND c.data IS NOT NULL
        AND jsonb_typeof(c.data) = 'object'
      LIMIT 5;
    `;

    if (carsWithEmptyPrices.length > 0) {
      console.log(`⚠️  Найдено ${carsWithEmptyPrices.length} машин с пустыми ценами но с данными:\n`);
      carsWithEmptyPrices.forEach(car => {
        console.log(`   ${car.car_name} (${car.code})`);
        console.log(`      deposit в БД: ${car.deposit || 'NULL'}`);
        console.log(`      deposit в data: ${car.data_deposit || 'NULL'}`);
        console.log(`      price_hour в БД: ${car.price_hour || 'NULL'}`);
        console.log(`      price_hour в data: ${car.data_price_hour || 'NULL'}\n`);
      });
    } else {
      console.log('✅ Не найдено машин с пустыми ценами в БД но непустым data\n');
    }

    // Проверяем логику COALESCE в SQL
    console.log('━━━ Проверка логики обновления (COALESCE) ━━━\n');
    console.log('📝 Текущая логика в "Save Cars" node:');
    console.log('   deposit = COALESCE(EXCLUDED.deposit, tgt.deposit)');
    console.log('   ↳ Если новый deposit = NULL → оставляем старый\n');
    console.log('   ✅ Это ПРАВИЛЬНО - пустые значения не затирают существующие!\n');

    // Статистика по ценам
    console.log('━━━ Статистика по ценам ━━━\n');
    const priceStats = await sql`
      SELECT
        COUNT(*) AS total_cars,
        COUNT(deposit) FILTER (WHERE deposit > 0) AS with_deposit,
        COUNT(price_hour) FILTER (WHERE price_hour > 0) AS with_price_hour,
        AVG(deposit) FILTER (WHERE deposit > 0) AS avg_deposit,
        AVG(price_hour) FILTER (WHERE price_hour > 0) AS avg_price_hour
      FROM cars;
    `;

    const stats = priceStats[0];
    console.log(`📊 Всего машин: ${stats.total_cars}`);
    console.log(`   С депозитом > 0: ${stats.with_deposit} (${((stats.with_deposit / stats.total_cars) * 100).toFixed(1)}%)`);
    console.log(`   С ценой/час > 0: ${stats.with_price_hour} (${((stats.with_price_hour / stats.total_cars) * 100).toFixed(1)}%)`);
    console.log(`   Средний депозит: ${Math.round(stats.avg_deposit)} GEL`);
    console.log(`   Средняя цена/час: ${Math.round(stats.avg_price_hour)} GEL\n`);

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
}

checkCarPricesInData();

