import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkBookingsExists() {
  try {
    console.log('='.repeat(80));
    console.log('ПРОВЕРКА: Есть ли брони в таблице bookings?');
    console.log('='.repeat(80));
    
    // Подсчет общего количества записей
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM bookings
    `;
    
    const totalBookings = parseInt(countResult[0].total);
    console.log(`\n📊 Всего записей в таблице bookings: ${totalBookings}\n`);
    
    if (totalBookings === 0) {
      console.log('❌ Таблица bookings ПУСТАЯ - нет ни одной записи!');
      return;
    }
    
    console.log('✅ В таблице есть брони. Показываю примеры...\n');
    
    // Примеры броней
    console.log('='.repeat(80));
    console.log('ПРИМЕРЫ БРОНЕЙ (последние 5 записей):');
    console.log('='.repeat(80));
    
    const examples = await sql`
      SELECT 
        b.id,
        b.car_id,
        b.client_id,
        b.state,
        b.status,
        b.start_at,
        b.end_at,
        b.created_at,
        c.plate,
        c.model
      FROM bookings b
      LEFT JOIN cars c ON c.id = b.car_id
      ORDER BY b.created_at DESC
      LIMIT 5
    `;
    
    examples.forEach((booking, idx) => {
      console.log(`\n--- Бронь ${idx + 1} ---`);
      console.log(`ID: ${booking.id}`);
      console.log(`Car ID: ${booking.car_id}`);
      console.log(`Car: ${booking.plate || 'N/A'} ${booking.model || ''}`);
      console.log(`Client ID: ${booking.client_id}`);
      console.log(`State: ${booking.state}`);
      console.log(`Status: ${booking.status}`);
      console.log(`Start: ${booking.start_at}`);
      console.log(`End: ${booking.end_at}`);
      console.log(`Created: ${booking.created_at}`);
    });
    
    // Статистика по статусам
    console.log('\n' + '='.repeat(80));
    console.log('СТАТИСТИКА ПО СТАТУСАМ:');
    console.log('='.repeat(80));
    
    const statusStats = await sql`
      SELECT 
        status,
        COUNT(*) as count
      FROM bookings
      GROUP BY status
      ORDER BY count DESC
    `;
    
    console.log('\n| Статус | Количество |');
    console.log('|--------|------------|');
    statusStats.forEach(stat => {
      console.log(`| ${stat.status || 'NULL'} | ${stat.count} |`);
    });
    
    // Статистика по состояниям
    console.log('\n' + '='.repeat(80));
    console.log('СТАТИСТИКА ПО СОСТОЯНИЯМ (STATE):');
    console.log('='.repeat(80));
    
    const stateStats = await sql`
      SELECT 
        state,
        COUNT(*) as count
      FROM bookings
      GROUP BY state
      ORDER BY count DESC
    `;
    
    console.log('\n| Состояние | Количество |');
    console.log('|-----------|------------|');
    stateStats.forEach(stat => {
      console.log(`| ${stat.state || 'NULL'} | ${stat.count} |`);
    });
    
    // Проверка связи с cars
    console.log('\n' + '='.repeat(80));
    console.log('ПРОВЕРКА СВЯЗИ С ТАБЛИЦЕЙ CARS:');
    console.log('='.repeat(80));
    
    const linkStats = await sql`
      SELECT 
        COUNT(*) as total_bookings,
        COUNT(DISTINCT car_id) as unique_cars,
        COUNT(CASE WHEN car_id IS NULL THEN 1 END) as no_car_id,
        COUNT(CASE WHEN car_id IS NOT NULL THEN 1 END) as with_car_id
      FROM bookings
    `;
    
    const stats = linkStats[0];
    console.log(`\nВсего броней: ${stats.total_bookings}`);
    console.log(`Уникальных car_id: ${stats.unique_cars}`);
    console.log(`Без car_id (NULL): ${stats.no_car_id}`);
    console.log(`С car_id: ${stats.with_car_id}`);
    
    // Проверка, есть ли брони для конкретных автомобилей
    console.log('\n' + '='.repeat(80));
    console.log('БРОНИ ДЛЯ АВТОМОБИЛЕЙ С PLATE:');
    console.log('='.repeat(80));
    
    const carsWithBookings = await sql`
      SELECT 
        c.plate,
        c.model,
        COUNT(b.id) as bookings_count
      FROM cars c
      LEFT JOIN bookings b ON b.car_id = c.id
      GROUP BY c.plate, c.model
      HAVING COUNT(b.id) > 0
      ORDER BY bookings_count DESC
      LIMIT 10
    `;
    
    console.log(`\nАвтомобилей с бронями: ${carsWithBookings.length}\n`);
    console.log('| Номер | Модель | Количество броней |');
    console.log('|-------|--------|-------------------|');
    carsWithBookings.forEach(car => {
      console.log(`| ${car.plate} | ${car.model} | ${car.bookings_count} |`);
    });
    
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

checkBookingsExists();

