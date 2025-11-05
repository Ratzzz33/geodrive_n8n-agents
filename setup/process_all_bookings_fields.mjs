import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 10,
  ssl: { rejectUnauthorized: false }
});

async function processAllBookings() {
  console.log('🔄 Processing all bookings - extracting fields from data\n');
  
  // Получить все брони где start_date = NULL но data имеет start_date
  const bookings = await sql`
    SELECT id, data
    FROM bookings
    WHERE start_date IS NULL
      AND data IS NOT NULL
      AND data::TEXT != '{}'
      AND data->>'start_date' IS NOT NULL
  `;
  
  console.log(`Found ${bookings.length} bookings to process\n`);
  
  let processed = 0;
  let errors = 0;
  
  for (const booking of bookings) {
    try {
      const data = booking.data;
      
      // Извлечь поля
      const startDate = data.start_date_formatted || data.start_date;
      const endDate = data.end_date_formatted || data.end_date;
      const state = data.state;
      const price = data.price;
      const days = data.days;
      const total = data.total;
      const deposit = data.deposit;
      
      // Обновить поля
      await sql`
        UPDATE bookings
        SET 
          start_date = ${startDate}::TIMESTAMPTZ,
          end_date = ${endDate}::TIMESTAMPTZ,
          state = ${state},
          price = ${price}::NUMERIC,
          days = ${days}::NUMERIC,
          total = ${total}::NUMERIC,
          deposit = ${deposit}::NUMERIC,
          updated_at = NOW()
        WHERE id = ${booking.id}
      `;
      
      processed++;
      
      if (processed % 100 === 0) {
        console.log(`   Processed: ${processed}/${bookings.length}`);
      }
      
    } catch (error) {
      errors++;
      if (errors < 5) {
        console.error(`   Error processing booking ${booking.id}: ${error.message}`);
      }
    }
  }
  
  console.log(`\n✅ Processing complete:`);
  console.log(`   Processed: ${processed}`);
  console.log(`   Errors: ${errors}`);
  
  await sql.end();
}

processAllBookings().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

