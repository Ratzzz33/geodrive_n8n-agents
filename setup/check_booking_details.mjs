import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkDetails() {
  console.log('🔍 Checking booking details...\n');
  
  try {
    // Получить одну последнюю бронь
    const booking = await sql`
      SELECT 
        b.id,
        b.data,
        b.start_date,
        b.end_date,
        b.state,
        b.price,
        b.car_id,
        b.client_id,
        (SELECT external_id FROM external_refs 
         WHERE entity_id = b.id AND entity_type = 'booking' AND system = 'rentprog') as rentprog_id
      FROM bookings b
      ORDER BY b.created_at DESC
      LIMIT 1
    `.then(rows => rows[0]);
    
    if (!booking) {
      console.log('No bookings found');
      return;
    }
    
    console.log(`📋 Booking ${booking.rentprog_id}:`);
    console.log(`   UUID: ${booking.id}`);
    console.log(`   start_date: ${booking.start_date}`);
    console.log(`   end_date: ${booking.end_date}`);
    console.log(`   state: ${booking.state}`);
    console.log(`   price: ${booking.price}`);
    console.log(`   car_id: ${booking.car_id}`);
    console.log(`   client_id: ${booking.client_id}`);
    console.log(`\n📦 Data fields:`);
    
    if (booking.data) {
      const data = booking.data;
      console.log(`   start_date_formatted: ${data.start_date_formatted}`);
      console.log(`   start_date: ${data.start_date}`);
      console.log(`   end_date_formatted: ${data.end_date_formatted}`);
      console.log(`   end_date: ${data.end_date}`);
      console.log(`   state: ${data.state}`);
      console.log(`   price: ${data.price}`);
      console.log(`   has car: ${!!data.car}`);
      console.log(`   has client: ${!!data.client}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sql.end();
  }
}

checkDetails();

