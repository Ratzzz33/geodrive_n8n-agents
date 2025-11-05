import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkDataContent() {
  console.log('🔍 Checking data field content\n');
  
  // Примеры data field
  const samples = await sql`
    SELECT 
      b.id,
      b.data,
      b.start_date,
      LENGTH(b.data::TEXT) as data_length
    FROM bookings b
    ORDER BY b.created_at DESC
    LIMIT 5
  `;
  
  for (const s of samples) {
    console.log(`UUID: ${s.id}`);
    console.log(`Data length: ${s.data_length || 0} chars`);
    console.log(`start_date field: ${s.start_date || 'NULL'}`);
    
    if (s.data) {
      const dataStr = JSON.stringify(s.data, null, 2);
      console.log(`Data preview: ${dataStr.substring(0, 200)}...`);
    } else {
      console.log('Data: NULL or empty');
    }
    console.log('');
  }
  
  // Статистика по data
  const stats = await sql`
    SELECT 
      COUNT(*) FILTER (WHERE data IS NULL) as null_data,
      COUNT(*) FILTER (WHERE data IS NOT NULL AND data::TEXT = '{}') as empty_data,
      COUNT(*) FILTER (WHERE data IS NOT NULL AND data::TEXT != '{}') as has_data,
      COUNT(*) as total
    FROM bookings
  `.then(rows => rows[0]);
  
  console.log('📊 Data field statistics:');
  console.log(`   NULL: ${stats.null_data}`);
  console.log(`   Empty {}: ${stats.empty_data}`);
  console.log(`   Has data: ${stats.has_data}`);
  console.log(`   Total: ${stats.total}`);
  
  await sql.end();
}

checkDataContent().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

