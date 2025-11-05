import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkDetails() {
  console.log('🔍 Checking Bookings Details\n');
  
  // Примеры броней БЕЗ раскладки
  const withoutDates = await sql`
    SELECT 
      b.id,
      b.data->>'id' as rentprog_id,
      b.data->>'start_date' as data_start_date,
      b.start_date,
      b.state,
      b.created_at
    FROM bookings b
    WHERE b.start_date IS NULL
    ORDER BY b.created_at DESC
    LIMIT 3
  `;
  
  console.log('❌ Bookings WITHOUT date fields (last 3):');
  for (const b of withoutDates) {
    console.log(`   - UUID: ${b.id}`);
    console.log(`     RentProg ID: ${b.rentprog_id}`);
    console.log(`     Data has start_date: ${b.data_start_date ? 'YES' : 'NO'}`);
    console.log(`     start_date field: ${b.start_date || 'NULL'}`);
    console.log(`     state field: ${b.state || 'NULL'}`);
    console.log('');
  }
  
  // Примеры броней С раскладкой
  const withDates = await sql`
    SELECT 
      b.id,
      b.data->>'id' as rentprog_id,
      b.start_date,
      b.end_date,
      b.state,
      b.price,
      b.car_id,
      b.client_id
    FROM bookings b
    WHERE b.start_date IS NOT NULL
    ORDER BY b.created_at DESC
    LIMIT 3
  `;
  
  console.log('✅ Bookings WITH date fields (last 3):');
  for (const b of withDates) {
    const startDate = b.start_date ? new Date(b.start_date).toISOString().split('T')[0] : 'NULL';
    const endDate = b.end_date ? new Date(b.end_date).toISOString().split('T')[0] : 'NULL';
    console.log(`   - RentProg #${b.rentprog_id}`);
    console.log(`     Dates: ${startDate} → ${endDate}`);
    console.log(`     State: ${b.state}, Price: ${b.price}`);
    console.log(`     Car: ${b.car_id ? '✓' : '✗'}, Client: ${b.client_id ? '✓' : '✗'}`);
    console.log('');
  }
  
  await sql.end();
}

checkDetails().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

