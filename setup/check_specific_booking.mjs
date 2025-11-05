import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkSpecificBooking() {
  const bookingId = '0500dccc-ae0e-4828-b25a-ef28ad62421a';
  
  console.log(`🔍 Checking booking ${bookingId}\n`);
  
  const booking = await sql`
    SELECT 
      id,
      data,
      start_date,
      end_date,
      state,
      price,
      car_id,
      client_id,
      created_at,
      updated_at
    FROM bookings
    WHERE id = ${bookingId}
  `.then(rows => rows[0]);
  
  console.log('Fields:');
  console.log(`  start_date: ${booking.start_date}`);
  console.log(`  end_date: ${booking.end_date}`);
  console.log(`  state: ${booking.state}`);
  console.log(`  price: ${booking.price}`);
  console.log(`  car_id: ${booking.car_id}`);
  console.log(`  client_id: ${booking.client_id}`);
  console.log('');
  
  console.log(`Data field type: ${typeof booking.data}`);
  console.log(`Data is null: ${booking.data === null}`);
  console.log(`Data is object: ${typeof booking.data === 'object'}`);
  
  if (booking.data) {
    console.log(`\nData keys: ${Object.keys(booking.data).join(', ')}`);
    console.log(`\nData sample:`);
    console.log(JSON.stringify(booking.data, null, 2).substring(0, 500));
  }
  
  await sql.end();
}

checkSpecificBooking().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

