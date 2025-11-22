import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function migrateLinkBookingsToCars() {
  try {
    console.log('='.repeat(80));
    console.log('🔗 МИГРАЦИЯ: Связываем bookings с cars через car_code');
    console.log('='.repeat(80));
    
    // Проверка текущего состояния
    console.log('\n--- Проверка текущего состояния ---\n');
    
    const beforeStats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(car_id) as with_car_id,
        COUNT(CASE WHEN car_id IS NULL THEN 1 END) as without_car_id
      FROM bookings
    `;
    
    const before = beforeStats[0];
    console.log(`Всего броней: ${before.total}`);
    console.log(`С car_id: ${before.with_car_id}`);
    console.log(`БЕЗ car_id: ${before.without_car_id}`);
    
    // Проверка потенциальных обновлений
    console.log('\n--- Проверка потенциальных обновлений ---\n');
    
    const toUpdate = await sql`
      SELECT COUNT(*) as count
      FROM bookings b
      INNER JOIN cars c ON c.code = b.car_code
      WHERE b.car_id IS NULL
    `;
    
    console.log(`Можно обновить записей: ${toUpdate[0].count}`);
    
    if (parseInt(toUpdate[0].count) === 0) {
      console.log('\n✅ Все брони уже связаны! Миграция не требуется.');
      return;
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('🚀 ВЫПОЛНЕНИЕ МИГРАЦИИ');
    console.log('='.repeat(80));
    console.log('\nОбновляем bookings.car_id через связь cars.code = bookings.car_code...\n');
    
    // Выполнение миграции
    const updateResult = await sql`
      UPDATE bookings b
      SET car_id = c.id
      FROM cars c
      WHERE c.code = b.car_code
        AND b.car_id IS NULL
    `;
    
    console.log(`✅ Обновлено записей: ${updateResult.count}`);
    
    // Проверка результата
    console.log('\n--- Проверка результата ---\n');
    
    const afterStats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(car_id) as with_car_id,
        COUNT(CASE WHEN car_id IS NULL THEN 1 END) as without_car_id
      FROM bookings
    `;
    
    const after = afterStats[0];
    console.log(`Всего броней: ${after.total}`);
    console.log(`С car_id: ${after.with_car_id} (было ${before.with_car_id})`);
    console.log(`БЕЗ car_id: ${after.without_car_id} (было ${before.without_car_id})`);
    console.log(`\nДобавлено связей: ${parseInt(after.with_car_id) - parseInt(before.with_car_id)}`);
    
    // Примеры обновленных записей
    console.log('\n' + '='.repeat(80));
    console.log('ПРИМЕРЫ ОБНОВЛЕННЫХ ЗАПИСЕЙ:');
    console.log('='.repeat(80));
    
    const examples = await sql`
      SELECT 
        b.id as booking_id,
        b.state,
        b.car_code,
        b.car_id,
        c.plate,
        c.model
      FROM bookings b
      INNER JOIN cars c ON c.id = b.car_id
      LIMIT 10
    `;
    
    console.log('\n| booking_id (first 8) | state | car_code | plate | model |');
    console.log('|----------------------|-------|----------|-------|-------|');
    examples.forEach(row => {
      console.log(`| ${row.booking_id.toString().substring(0, 8)}... | ${row.state} | ${row.car_code} | ${row.plate} | ${row.model} |`);
    });
    
    // Брони без связи
    if (parseInt(after.without_car_id) > 0) {
      console.log('\n' + '='.repeat(80));
      console.log(`⚠️ БРОНИ БЕЗ СВЯЗИ: ${after.without_car_id}`);
      console.log('='.repeat(80));
      
      const notLinked = await sql`
        SELECT 
          car_code,
          car_name,
          COUNT(*) as count
        FROM bookings
        WHERE car_id IS NULL
        GROUP BY car_code, car_name
        ORDER BY count DESC
      `;
      
      console.log('\nАвтомобили не найдены в таблице cars:\n');
      console.log('| car_code | car_name | Количество броней |');
      console.log('|----------|----------|-------------------|');
      notLinked.forEach(row => {
        console.log(`| ${row.car_code} | ${row.car_name} | ${row.count} |`);
      });
      
      console.log('\n💡 Эти автомобили нужно добавить в таблицу cars.');
    }
    
    // Проверка для RR350FR, RL630RL, LL760ZZ
    console.log('\n' + '='.repeat(80));
    console.log('🎯 ПРОВЕРКА: Брони для RR350FR, RL630RL, LL760ZZ');
    console.log('='.repeat(80));
    
    const targetCarsBookings = await sql`
      SELECT 
        c.plate,
        c.model,
        COUNT(b.id) as bookings_count
      FROM cars c
      LEFT JOIN bookings b ON b.car_id = c.id
      WHERE c.plate IN ('RR350FR', 'RL630RL', 'LL760ZZ')
      GROUP BY c.plate, c.model
    `;
    
    console.log('\n| Plate | Model | Количество броней |');
    console.log('|-------|-------|-------------------|');
    targetCarsBookings.forEach(row => {
      console.log(`| ${row.plate} | ${row.model} | ${row.bookings_count} |`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ МИГРАЦИЯ ЗАВЕРШЕНА УСПЕШНО!');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Ошибка при миграции:', error.message);
    console.error(error);
  } finally {
    await sql.end();
  }
}

migrateLinkBookingsToCars();

