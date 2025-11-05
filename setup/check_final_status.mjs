import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkFinalStatus() {
  console.log('⏳ Ожидание 10 секунд для завершения обработки...\n');
  await sleep(10000);
  
  console.log('📊 Финальная проверка статуса\n');
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
  
  const processedPercent = ((parseInt(stats.processed) / parseInt(stats.total)) * 100).toFixed(2);
  
  console.log(`\n✅ Обработка завершена!`);
  console.log('');
  console.log(`📦 Всего броней: ${stats.total}`);
  console.log(`✅ Обработано (data = {}): ${stats.processed} (${processedPercent}%)`);
  console.log(`⏳ Осталось: ${stats.remaining}`);
  console.log('');
  console.log(`🚗 С привязкой к машине: ${stats.with_car}`);
  console.log(`👤 С привязкой к клиенту: ${stats.with_client}`);
  console.log(`📅 С датами: ${stats.with_dates}`);
  
  if (parseInt(stats.remaining) > 0) {
    console.log(`\n⚠️ Осталось ${stats.remaining} необработанных броней`);
    
    // Показать детали необработанных
    const unprocessed = await sql`
      SELECT 
        id,
        LEFT(data::TEXT, 150) as data_sample,
        created_at,
        updated_at
      FROM bookings
      WHERE data IS NOT NULL 
        AND data::TEXT != '{}' 
        AND data::TEXT != 'null'
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    console.log('\nПримеры необработанных:');
    for (const u of unprocessed) {
      console.log(`   - ${u.id}`);
      console.log(`     Sample: ${u.data_sample}...`);
      console.log(`     Created: ${u.created_at}`);
    }
  } else {
    console.log('\n🎉 ВСЕ БРОНИ ОБРАБОТАНЫ!');
    console.log('✅ Поле data = {} для всех записей');
  }
  
  await sql.end();
}

checkFinalStatus().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

