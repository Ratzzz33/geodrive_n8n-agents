import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkCarCodeLink() {
  try {
    console.log('='.repeat(80));
    console.log('ПРОВЕРКА: Можно ли связать через car_code?');
    console.log('='.repeat(80));
    
    // Проверяем поле car (jsonb)
    console.log('\n--- Проверяем поле car (jsonb) ---\n');
    
    const carJsonbExamples = await sql`
      SELECT 
        id,
        state,
        car_code,
        car_name,
        car as car_jsonb
      FROM bookings
      WHERE car IS NOT NULL
      LIMIT 5
    `;
    
    console.log(`Записей с заполненным car (jsonb): ${carJsonbExamples.length}\n`);
    
    carJsonbExamples.forEach((row, idx) => {
      console.log(`\n=== Запись ${idx + 1} ===`);
      console.log(`ID: ${row.id}`);
      console.log(`car_code: ${row.car_code}`);
      console.log(`car_name: ${row.car_name}`);
      console.log(`car (jsonb):`);
      console.log(JSON.stringify(row.car_jsonb, null, 2));
    });
    
    // Статистика по car_code
    console.log('\n' + '='.repeat(80));
    console.log('СТАТИСТИКА: car_code в bookings');
    console.log('='.repeat(80));
    
    const carCodeStats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(car_code) as with_car_code,
        COUNT(DISTINCT car_code) as unique_car_codes
      FROM bookings
    `;
    
    const stats = carCodeStats[0];
    console.log(`\nВсего броней: ${stats.total}`);
    console.log(`С car_code: ${stats.with_car_code}`);
    console.log(`Уникальных car_code: ${stats.unique_car_codes}`);
    
    // Примеры car_code
    console.log('\n--- ТОП-10 car_code по количеству броней ---\n');
    
    const topCarCodes = await sql`
      SELECT 
        car_code,
        car_name,
        COUNT(*) as bookings_count
      FROM bookings
      WHERE car_code IS NOT NULL
      GROUP BY car_code, car_name
      ORDER BY bookings_count DESC
      LIMIT 10
    `;
    
    console.log('| car_code | car_name | Количество броней |');
    console.log('|----------|----------|-------------------|');
    topCarCodes.forEach(row => {
      console.log(`| ${row.car_code} | ${row.car_name} | ${row.bookings_count} |`);
    });
    
    // Проверяем таблицу cars
    console.log('\n' + '='.repeat(80));
    console.log('ПРОВЕРКА: Есть ли car_code в таблице cars?');
    console.log('='.repeat(80));
    
    const carsColumns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'cars'
        AND column_name LIKE '%code%'
    `;
    
    console.log(`\nПоля с "code" в таблице cars: ${carsColumns.length}\n`);
    carsColumns.forEach(col => {
      console.log(`- ${col.column_name}`);
    });
    
    // Примеры из cars
    console.log('\n--- Примеры из таблицы cars ---\n');
    
    const carsExamples = await sql`
      SELECT 
        id,
        plate,
        model,
        brand,
        data
      FROM cars
      LIMIT 5
    `;
    
    carsExamples.forEach((row, idx) => {
      console.log(`\n=== Автомобиль ${idx + 1} ===`);
      console.log(`ID: ${row.id}`);
      console.log(`Plate: ${row.plate}`);
      console.log(`Brand: ${row.brand}`);
      console.log(`Model: ${row.model}`);
      if (row.data) {
        console.log(`data (jsonb):`);
        console.log(JSON.stringify(row.data, null, 2));
      }
    });
    
    // Проверка: есть ли в cars.data поле code
    console.log('\n' + '='.repeat(80));
    console.log('ПРОВЕРКА: Есть ли в cars.data поле "code"?');
    console.log('='.repeat(80));
    
    const carsWithCode = await sql`
      SELECT 
        id,
        plate,
        model,
        data->>'code' as code,
        data->>'id' as rentprog_id
      FROM cars
      WHERE data->>'code' IS NOT NULL
      LIMIT 10
    `;
    
    console.log(`\nАвтомобилей с data->>'code': ${carsWithCode.length}\n`);
    
    if (carsWithCode.length > 0) {
      console.log('| plate | model | code | rentprog_id |');
      console.log('|-------|-------|------|-------------|');
      carsWithCode.forEach(row => {
        console.log(`| ${row.plate} | ${row.model} | ${row.code || 'N/A'} | ${row.rentprog_id || 'N/A'} |`);
      });
      
      // Тест связи через code
      console.log('\n' + '='.repeat(80));
      console.log('ТЕСТ: Связь bookings.car_code с cars.data->>\'code\'');
      console.log('='.repeat(80));
      
      const linkTest = await sql`
        SELECT 
          b.id as booking_id,
          b.car_code,
          b.car_name,
          c.id as car_uuid,
          c.plate,
          c.model
        FROM bookings b
        INNER JOIN cars c ON c.data->>'code' = b.car_code
        LIMIT 10
      `;
      
      console.log(`\nУспешно связанных: ${linkTest.length}\n`);
      
      if (linkTest.length > 0) {
        console.log('✅ СВЯЗЬ РАБОТАЕТ через car_code!\n');
        console.log('| booking_id | car_code | plate | model |');
        console.log('|------------|----------|-------|-------|');
        linkTest.forEach(row => {
          console.log(`| ${row.booking_id.substring(0, 8)}... | ${row.car_code} | ${row.plate} | ${row.model} |`);
        });
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Проверка завершена');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Ошибка при проверке:', error.message);
    console.error(error);
  } finally {
    await sql.end();
  }
}

checkCarCodeLink();

