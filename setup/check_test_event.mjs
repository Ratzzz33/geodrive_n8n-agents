import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('Проверка последних событий в БД...\n');
  
  // Последние 5 событий
  const events = await sql`
    SELECT id, ts, branch, type, ext_id, ok, reason, processed
    FROM events
    ORDER BY ts DESC
    LIMIT 5
  `;
  
  if (events.length === 0) {
    console.log('⚠️ Событий в БД не найдено');
  } else {
    console.log('Последние события:');
    events.forEach(e => {
      console.log(`\n  ID: ${e.id}`);
      console.log(`  Время: ${e.ts}`);
      console.log(`  Branch: ${e.branch}`);
      console.log(`  Type: ${e.type}`);
      console.log(`  Ext ID: ${e.ext_id}`);
      console.log(`  OK: ${e.ok}`);
      console.log(`  Reason: ${e.reason}`);
      console.log(`  Processed: ${e.processed}`);
    });
  }
  
  // Статистика
  const stats = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE processed = FALSE) as unprocessed,
      COUNT(*) FILTER (WHERE processed = TRUE) as processed
    FROM events
  `;
  
  console.log('\n📊 Статистика:');
  console.log(`  Всего событий: ${stats[0].total}`);
  console.log(`  Необработанных: ${stats[0].unprocessed}`);
  console.log(`  Обработанных: ${stats[0].processed}`);
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}
