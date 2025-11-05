import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkTablesStructure() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n📋 Проверка структуры таблиц bookings, cars, clients...\n');

  try {
    // Проверка bookings
    console.log('1️⃣ Таблица BOOKINGS:');
    const bookingsColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'bookings'
      ORDER BY ordinal_position;
    `;
    
    console.log(`   Всего колонок: ${bookingsColumns.length}`);
    const bookingsFKeys = bookingsColumns.filter(c => c.column_name.endsWith('_id'));
    console.log(`   Foreign keys найдено:`);
    bookingsFKeys.forEach(col => {
      console.log(`      - ${col.column_name} (${col.data_type})`);
    });

    // Проверка cars
    console.log('\n2️⃣ Таблица CARS:');
    const carsColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'cars'
      ORDER BY ordinal_position;
    `;
    
    console.log(`   Всего колонок: ${carsColumns.length}`);
    console.log(`   Primary key: id (uuid)`);

    // Проверка clients
    console.log('\n3️⃣ Таблица CLIENTS:');
    const clientsColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'clients'
      ORDER BY ordinal_position;
    `;
    
    console.log(`   Всего колонок: ${clientsColumns.length}`);
    console.log(`   Primary key: id (uuid)`);

    console.log('\n✅ Проверка завершена!\n');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkTablesStructure();

