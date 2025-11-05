import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

console.log('\n🔍 Проверка booking foreign keys...\n');

try {
  const bookingId = '597023c8-04ae-40d0-b1a1-cc792b1a5f46';
  
  // 1. Проверяем booking
  console.log('1️⃣ Проверка booking:');
  const booking = await sql`
    SELECT id, car_id, client_id, updated_at
    FROM bookings
    WHERE id = ${bookingId}
  `;
  
  if (booking.length === 0) {
    console.log('   ❌ Booking не найден!');
    process.exit(1);
  }
  
  console.log(`   ✓ Booking ID: ${booking[0].id}`);
  console.log(`   ✓ Car ID: ${booking[0].car_id}`);
  console.log(`   ✓ Client ID: ${booking[0].client_id}`);
  console.log(`   ✓ Updated: ${booking[0].updated_at}\n`);
  
  // 2. Проверяем car
  if (booking[0].car_id) {
    console.log('2️⃣ Проверка car:');
    const car = await sql`
      SELECT c.id, c.plate_number, c.model, er.external_id
      FROM cars c
      LEFT JOIN external_refs er ON er.entity_id = c.id AND er.system = 'rentprog'
      WHERE c.id = ${booking[0].car_id}
    `;
    
    if (car.length > 0) {
      console.log(`   ✓ Car UUID: ${car[0].id}`);
      console.log(`   ✓ RentProg ID: ${car[0].external_id}`);
      console.log(`   ✓ Plate: ${car[0].plate_number || 'N/A'}`);
      console.log(`   ✓ Model: ${car[0].model || 'N/A'}\n`);
    } else {
      console.log('   ❌ Car не найден!\n');
    }
  }
  
  // 3. Проверяем client
  if (booking[0].client_id) {
    console.log('3️⃣ Проверка client:');
    const client = await sql`
      SELECT c.id, c.name, c.phone, er.external_id
      FROM clients c
      LEFT JOIN external_refs er ON er.entity_id = c.id AND er.system = 'rentprog'
      WHERE c.id = ${booking[0].client_id}
    `;
    
    if (client.length > 0) {
      console.log(`   ✓ Client UUID: ${client[0].id}`);
      console.log(`   ✓ RentProg ID: ${client[0].external_id}`);
      console.log(`   ✓ Name: ${client[0].name || 'N/A'}`);
      console.log(`   ✓ Phone: ${client[0].phone || 'N/A'}\n`);
    } else {
      console.log('   ❌ Client не найден!\n');
    }
  }
  
  console.log('✅ Проверка завершена успешно!\n');
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

