import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkBooking486033() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n🔍 Проверка booking ID 486033...\n');

  try {
    // 1. Проверка в external_refs
    console.log('1️⃣ Проверка в external_refs...');
    const externalRef = await sql`
      SELECT * FROM external_refs 
      WHERE system = 'rentprog' 
      AND external_id = '486033';
    `;

    if (externalRef.length > 0) {
      console.log('   ✅ НАЙДЕН в external_refs!');
      console.log('   Entity ID:', externalRef[0].entity_id);
      console.log('   Entity Type:', externalRef[0].entity_type);
      console.log('   Data keys:', Object.keys(externalRef[0].data).length, 'полей');
    } else {
      console.log('   ❌ НЕ НАЙДЕН в external_refs');
      return;
    }

    // 2. Проверка в bookings
    console.log('\n2️⃣ Проверка в bookings...');
    const booking = await sql`
      SELECT * FROM bookings 
      WHERE id = ${externalRef[0].entity_id};
    `;

    if (booking.length > 0) {
      console.log('   ✅ НАЙДЕН в bookings!');
      const b = booking[0];
      console.log(`\n   📋 Основные данные:`);
      console.log(`      ID: ${b.id}`);
      console.log(`      Number: ${b.number || 'N/A'}`);
      console.log(`      Start Date: ${b.start_date || 'N/A'}`);
      console.log(`      End Date: ${b.end_date || 'N/A'}`);
      console.log(`      Total: ${b.total || 'N/A'}`);
      console.log(`      State: ${b.state || 'N/A'}`);
      console.log(`      Location Start: ${b.location_start || 'N/A'}`);
      console.log(`      Location End: ${b.location_end || 'N/A'}`);
      console.log(`      Created: ${b.created_at}`);
      console.log(`      Updated: ${b.updated_at}`);
    } else {
      console.log('   ❌ НЕ НАЙДЕН в bookings');
    }

    // 3. Проверка созданных колонок
    console.log('\n3️⃣ Колонки в таблице bookings...');
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns
      WHERE table_name = 'bookings'
      ORDER BY ordinal_position;
    `;

    console.log(`   Всего колонок: ${columns.length}\n`);
    const sampleColumns = columns.slice(0, 20);
    sampleColumns.forEach(col => {
      console.log(`   ${col.column_name.padEnd(30)} ${col.data_type}`);
    });
    
    if (columns.length > 20) {
      console.log(`   ... и еще ${columns.length - 20} колонок`);
    }

    console.log('\n✅ Проверка завершена!\n');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkBooking486033();

