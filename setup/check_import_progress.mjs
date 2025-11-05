import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkProgress() {
  console.log('📊 Import Progress Check');
  console.log('='.repeat(60));
  console.log('');
  
  // Подсчёт броней
  const bookingsCount = await sql`
    SELECT COUNT(*) as total
    FROM bookings
  `.then(rows => rows[0].total);
  
  const bookingsWithData = await sql`
    SELECT COUNT(*) as total
    FROM bookings
    WHERE start_date IS NOT NULL
  `.then(rows => rows[0].total);
  
  const bookingsWithLinks = await sql`
    SELECT COUNT(*) as total
    FROM bookings
    WHERE car_id IS NOT NULL AND client_id IS NOT NULL
  `.then(rows => rows[0].total);
  
  // Подсчёт машин
  const carsCount = await sql`
    SELECT COUNT(*) as total
    FROM cars
  `.then(rows => rows[0].total);
  
  // Подсчёт клиентов
  const clientsCount = await sql`
    SELECT COUNT(*) as total
    FROM clients
  `.then(rows => rows[0].total);
  
  // Последние добавленные брони
  const recentBookings = await sql`
    SELECT 
      b.id,
      b.start_date,
      b.end_date,
      b.state,
      b.price,
      b.created_at,
      er.external_id as rentprog_id
    FROM bookings b
    LEFT JOIN external_refs er ON b.id = er.entity_id AND er.entity_type = 'booking'
    ORDER BY b.created_at DESC
    LIMIT 5
  `;
  
  console.log('📦 Bookings:');
  console.log(`   Total: ${bookingsCount}`);
  console.log(`   With dates: ${bookingsWithData}`);
  console.log(`   With car & client links: ${bookingsWithLinks}`);
  console.log('');
  
  console.log('🚗 Cars: ' + carsCount);
  console.log('👤 Clients: ' + clientsCount);
  console.log('');
  
  console.log('🆕 Last 5 bookings:');
  for (const booking of recentBookings) {
    const startDate = booking.start_date ? new Date(booking.start_date).toISOString().split('T')[0] : 'N/A';
    const state = booking.state || 'N/A';
    const price = booking.price || 'N/A';
    console.log(`   - RentProg #${booking.rentprog_id}: ${startDate} | ${state} | ${price} GEL`);
  }
  
  console.log('');
  console.log('✅ Check complete');
  
  await sql.end();
}

checkProgress().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
