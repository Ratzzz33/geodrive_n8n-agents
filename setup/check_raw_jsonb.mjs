import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkRawJsonb() {
  console.log('🔍 Checking raw JSONB\n');
  
  const bookingId = '0500dccc-ae0e-4828-b25a-ef28ad62421a';
  
  const result = await sql`
    SELECT 
      id,
      data::TEXT as data_text,
      jsonb_typeof(data) as jsonb_type,
      LENGTH(data::TEXT) as data_length
    FROM bookings
    WHERE id = ${bookingId}
  `.then(rows => rows[0]);
  
  console.log(`JSONB type: ${result.jsonb_type}`);
  console.log(`Data length: ${result.data_length}`);
  console.log(`\nFirst 500 chars of data:`);
  console.log(result.data_text.substring(0, 500));
  
  await sql.end();
}

checkRawJsonb().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

