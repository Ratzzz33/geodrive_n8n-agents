import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false },
  // Важно! Отключаем автопарсинг
  types: {
    bigint: postgres.BigInt
  }
});

async function testExtraction() {
  console.log('🔍 Testing JSONB extraction\n');
  
  const bookingId = '0500dccc-ae0e-4828-b25a-ef28ad62421a';
  
  //  Прямой SQL запрос с извлечением
  const result = await sql`
    SELECT 
      id,
      data->'id' as rentprog_id_json,
      data->>'id' as rentprog_id_text,
      data->>'start_date' as start_date_text,
      pg_typeof(data) as data_type
    FROM bookings
    WHERE id = ${bookingId}
  `.then(rows => rows[0]);
  
  console.log('Result:');
  console.log(`  ID: ${result.id}`);
  console.log(`  data->'id': ${result.rentprog_id_json}`);
  console.log(`  data->>'id': ${result.rentprog_id_text}`);
  console.log(`  data->>'start_date': ${result.start_date_text}`);
  console.log(`  pg_typeof(data): ${result.data_type}`);
  
  await sql.end();
}

testExtraction().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

