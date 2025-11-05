import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkProgress() {
  console.log('📊 Прогресс обработки броней\n');
  console.log('='.repeat(60));
  
  const stats = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE data::TEXT = '{}') as processed,
      COUNT(*) FILTER (WHERE data IS NOT NULL AND data::TEXT != '{}' AND data::TEXT != 'null') as remaining,
      COUNT(*) FILTER (WHERE car_id IS NOT NULL) as with_car,
      COUNT(*) FILTER (WHERE client_id IS NOT NULL) as with_client,
      COUNT(*) FILTER (WHERE start_date IS NOT NULL) as with_dates
    FROM bookings
  `.then(rows => rows[0]);
  
  const processedPercent = ((parseInt(stats.processed) / parseInt(stats.total)) * 100).toFixed(1);
  
  console.log(`\n📦 Всего броней: ${stats.total}`);
  console.log(`✅ Обработано (data = {}): ${stats.processed} (${processedPercent}%)`);
  console.log(`⏳ Осталось обработать: ${stats.remaining}`);
  console.log('');
  console.log(`🚗 С привязкой к машине: ${stats.with_car}`);
  console.log(`👤 С привязкой к клиенту: ${stats.with_client}`);
  console.log(`📅 С датами: ${stats.with_dates}`);
  
  // Примеры необработанных
  if (parseInt(stats.remaining) > 0) {
    console.log('\n📋 Примеры необработанных броней:');
    const samples = await sql`
      SELECT 
        id,
        LEFT(data::TEXT, 100) as data_sample,
        created_at
      FROM bookings
      WHERE data IS NOT NULL 
        AND data::TEXT != '{}' 
        AND data::TEXT != 'null'
      ORDER BY created_at DESC
      LIMIT 5
    `;
    
    for (const s of samples) {
      console.log(`   - ${s.id}: ${s.data_sample}...`);
    }
  }
  
  // Примеры обработанных
  console.log('\n✅ Примеры обработанных броней:');
  const processed = await sql`
    SELECT 
      id,
      car_id,
      client_id,
      start_date,
      state,
      price,
      data::TEXT as data_status
    FROM bookings
    WHERE data::TEXT = '{}'
    ORDER BY updated_at DESC
    LIMIT 3
  `;
  
  for (const p of processed) {
    console.log(`   - ${p.id}:`);
    console.log(`     car_id: ${p.car_id ? '✓' : '✗'}, client_id: ${p.client_id ? '✓' : '✗'}`);
    console.log(`     start_date: ${p.start_date || 'NULL'}, state: ${p.state || 'NULL'}`);
    console.log(`     data: ${p.data_status}`);
  }
  
  await sql.end();
}

checkProgress().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

