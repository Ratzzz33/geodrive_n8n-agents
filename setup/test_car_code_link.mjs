import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function testCarCodeLink() {
  try {
    console.log('='.repeat(80));
    console.log('ТЕСТ: Связь bookings.car_code с cars.code');
    console.log('='.repeat(80));
    
    // Проверяем структуру таблицы cars
    console.log('\n--- Структура таблицы cars ---\n');
    
    const carsColumns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'cars'
      ORDER BY ordinal_position
      LIMIT 20
    `;
    
    console.log('| Поле | Тип |');
    console.log('|------|-----|');
    carsColumns.forEach(col => {
      console.log(`| ${col.column_name} | ${col.data_type} |`);
    });
    
    // Примеры из cars
    console.log('\n--- Примеры из таблицы cars ---\n');
    
    const carsExamples = await sql`
      SELECT 
        id,
        plate,
        model,
        code,
        data
      FROM cars
      LIMIT 5
    `;
    
    carsExamples.forEach((row, idx) => {
      console.log(`\n=== Автомобиль ${idx + 1} ===`);
      console.log(`ID: ${row.id}`);
      console.log(`Plate: ${row.plate}`);
      console.log(`Model: ${row.model}`);
      console.log(`Code: ${row.code || 'N/A'}`);
      if (row.data && Object.keys(row.data).length > 0) {
        console.log(`data (jsonb) - ключи: ${Object.keys(row.data).join(', ')}`);
      } else {
        console.log(`data: пусто`);
      }
    });
    
    // Статистика по code в cars
    console.log('\n' + '='.repeat(80));
    console.log('СТАТИСТИКА: code в таблице cars');
    console.log('='.repeat(80));
    
    const carsCodeStats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(code) as with_code,
        COUNT(DISTINCT code) as unique_codes
      FROM cars
    `;
    
    const stats = carsCodeStats[0];
    console.log(`\nВсего автомобилей: ${stats.total}`);
    console.log(`С code: ${stats.with_code}`);
    console.log(`Уникальных code: ${stats.unique_codes}`);
    
    // Примеры code из cars
    console.log('\n--- Примеры code из cars ---\n');
    
    const carsCodeExamples = await sql`
      SELECT 
        id,
        plate,
        model,
        code
      FROM cars
      WHERE code IS NOT NULL
      LIMIT 10
    `;
    
    console.log('| plate | model | code |');
    console.log('|-------|-------|------|');
    carsCodeExamples.forEach(row => {
      console.log(`| ${row.plate} | ${row.model} | ${row.code} |`);
    });
    
    // ГЛАВНЫЙ ТЕСТ: Связь через code
    console.log('\n' + '='.repeat(80));
    console.log('🎯 ГЛАВНЫЙ ТЕСТ: bookings.car_code = cars.code');
    console.log('='.repeat(80));
    
    const linkTest = await sql`
      SELECT 
        b.id as booking_id,
        b.state,
        b.car_code as booking_car_code,
        b.car_name as booking_car_name,
        c.id as car_uuid,
        c.plate,
        c.model,
        c.code as car_code
      FROM bookings b
      INNER JOIN cars c ON c.code = b.car_code
      LIMIT 15
    `;
    
    console.log(`\n✅ Успешно связанных записей: ${linkTest.length}\n`);
    
    if (linkTest.length > 0) {
      console.log('🎉 СВЯЗЬ РАБОТАЕТ через car_code = code!\n');
      console.log('| booking_id (first 8) | state | car_code | plate | model |');
      console.log('|----------------------|-------|----------|-------|-------|');
      linkTest.forEach(row => {
        console.log(`| ${row.booking_id.toString().substring(0, 8)}... | ${row.state} | ${row.booking_car_code} | ${row.plate} | ${row.model} |`);
      });
      
      // Подсчет всех возможных связей
      console.log('\n' + '='.repeat(80));
      console.log('СТАТИСТИКА: Сколько броней можно связать?');
      console.log('='.repeat(80));
      
      const linkStats = await sql`
        SELECT COUNT(*) as linkable_bookings
        FROM bookings b
        INNER JOIN cars c ON c.code = b.car_code
      `;
      
      console.log(`\nБроней, которые можно связать: ${linkStats[0].linkable_bookings} из 2823`);
      console.log(`Процент: ${((linkStats[0].linkable_bookings / 2823) * 100).toFixed(2)}%`);
      
      // Брони БЕЗ связи
      const notLinkedCount = await sql`
        SELECT COUNT(*) as not_linked
        FROM bookings b
        LEFT JOIN cars c ON c.code = b.car_code
        WHERE c.id IS NULL
      `;
      
      console.log(`\nБроней БЕЗ связи: ${notLinkedCount[0].not_linked}`);
      
      // Примеры броней без связи
      if (parseInt(notLinkedCount[0].not_linked) > 0) {
        console.log('\n--- Примеры броней БЕЗ связи (car_code не найден в cars) ---\n');
        
        const notLinkedExamples = await sql`
          SELECT 
            b.car_code,
            b.car_name,
            COUNT(*) as count
          FROM bookings b
          LEFT JOIN cars c ON c.code = b.car_code
          WHERE c.id IS NULL
          GROUP BY b.car_code, b.car_name
          ORDER BY count DESC
          LIMIT 10
        `;
        
        console.log('| car_code | car_name | Количество броней |');
        console.log('|----------|----------|-------------------|');
        notLinkedExamples.forEach(row => {
          console.log(`| ${row.car_code} | ${row.car_name} | ${row.count} |`);
        });
      }
      
    } else {
      console.log('❌ Связь НЕ работает');
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

testCarCodeLink();

