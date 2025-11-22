import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function queryBookingsStructure() {
  try {
    console.log('='.repeat(80));
    console.log('ЗАПРОС 1: Примеры записей из bookings для RR350FR, RL630RL, LL760ZZ');
    console.log('='.repeat(80));
    
    const bookingsExamples = await sql`
      SELECT 
        b.id,
        b.car_id,
        b.state,
        b.status,
        b.start_date,
        b.start_at,
        b.end_date,
        b.end_at,
        b.data,
        c.plate,
        c.model
      FROM bookings b
      LEFT JOIN cars c ON c.id = b.car_id
      WHERE c.plate IN ('RR350FR', 'RL630RL', 'LL760ZZ')
      LIMIT 5
    `;
    
    console.log(`\nНайдено записей: ${bookingsExamples.length}\n`);
    bookingsExamples.forEach((row, idx) => {
      console.log(`\n--- Запись ${idx + 1} ---`);
      console.log(`ID: ${row.id}`);
      console.log(`Car ID: ${row.car_id}`);
      console.log(`Plate: ${row.plate}`);
      console.log(`Model: ${row.model}`);
      console.log(`State: ${row.state}`);
      console.log(`Status: ${row.status}`);
      console.log(`Start Date: ${row.start_date}`);
      console.log(`Start At: ${row.start_at}`);
      console.log(`End Date: ${row.end_date}`);
      console.log(`End At: ${row.end_at}`);
      console.log(`Data (JSON): ${JSON.stringify(row.data, null, 2)}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('ЗАПРОС 2: Структура таблицы bookings');
    console.log('='.repeat(80));
    
    const structure = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'bookings'
      ORDER BY ordinal_position
    `;
    
    console.log(`\nВсего полей: ${structure.length}\n`);
    console.log('| Поле | Тип данных | Nullable |');
    console.log('|------|-----------|----------|');
    structure.forEach(col => {
      console.log(`| ${col.column_name} | ${col.data_type} | ${col.is_nullable} |`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('ЗАПРОС 3: Связь car_id между bookings и cars');
    console.log('='.repeat(80));
    
    console.log('\n--- Найти car_id для этих авто ---');
    const carIds = await sql`
      SELECT id, plate, model
      FROM cars
      WHERE plate IN ('RR350FR', 'RL630RL', 'LL760ZZ')
    `;
    
    console.log(`\nНайдено автомобилей: ${carIds.length}\n`);
    carIds.forEach(car => {
      console.log(`ID: ${car.id} | Plate: ${car.plate} | Model: ${car.model}`);
    });

    console.log('\n--- Проверить есть ли брони для этих car_id ---');
    const bookingsForCars = await sql`
      SELECT 
        b.id,
        b.car_id,
        b.state,
        b.status,
        COALESCE(b.start_date::timestamptz, b.start_at) as start_time,
        COALESCE(b.end_date::timestamptz, b.end_at) as end_time
      FROM bookings b
      WHERE b.car_id IN (
        SELECT id FROM cars WHERE plate IN ('RR350FR', 'RL630RL', 'LL760ZZ')
      )
      ORDER BY COALESCE(b.start_date::timestamptz, b.start_at) DESC
      LIMIT 10
    `;
    
    console.log(`\nНайдено броней: ${bookingsForCars.length}\n`);
    bookingsForCars.forEach((booking, idx) => {
      console.log(`\n${idx + 1}. ID: ${booking.id}`);
      console.log(`   Car ID: ${booking.car_id}`);
      console.log(`   State: ${booking.state}`);
      console.log(`   Status: ${booking.status}`);
      console.log(`   Start Time: ${booking.start_time}`);
      console.log(`   End Time: ${booking.end_time}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ Все запросы выполнены успешно');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Ошибка при выполнении запросов:', error.message);
    console.error(error);
  } finally {
    await sql.end();
  }
}

queryBookingsStructure();

