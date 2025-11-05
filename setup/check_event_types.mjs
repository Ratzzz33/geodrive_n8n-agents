import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    console.log('📊 Проверка типов событий за последние 24 часа...\n');
    
    // Статистика по типам за 24 часа
    const stats = await sql`
      SELECT 
        type, 
        COUNT(*) as cnt, 
        MAX(ts) as last_event
      FROM events 
      WHERE ts > NOW() - INTERVAL '24 hours'
      GROUP BY type 
      ORDER BY cnt DESC
    `;
    
    if (stats.length === 0) {
      console.log('⚠️  Нет событий за последние 24 часа');
    } else {
      console.log('Типы событий (24 часа):');
      stats.forEach(row => {
        console.log(`  • ${row.type}: ${row.cnt} (последний: ${row.last_event.toISOString()})`);
      });
    }
    
    // Проверяем конкретно client_update
    const clientUpdates = await sql`
      SELECT 
        id, ts, type, rentprog_id, company_id, ok, processed
      FROM events 
      WHERE type LIKE '%client%' 
        AND ts > NOW() - INTERVAL '24 hours'
      ORDER BY ts DESC
      LIMIT 20
    `;
    
    console.log(`\n🔍 client_update события (последние 20 за 24ч):`);
    if (clientUpdates.length === 0) {
      console.log('  ❌ Нет событий типа client_update за последние 24 часа');
    } else {
      clientUpdates.forEach(e => {
        console.log(`  • ${e.ts.toISOString()} - ${e.type} (ID: ${e.rentprog_id}, company: ${e.company_id}, processed: ${e.processed})`);
      });
    }
    
    // Проверяем все события с "client" в reason
    const clientInReason = await sql`
      SELECT 
        id, ts, type, rentprog_id, reason
      FROM events 
      WHERE reason LIKE '%client%' 
        AND ts > NOW() - INTERVAL '24 hours'
      ORDER BY ts DESC
      LIMIT 10
    `;
    
    if (clientInReason.length > 0) {
      console.log(`\n📝 События с "client" в reason (последние 10):`);
      clientInReason.forEach(e => {
        console.log(`  • ${e.ts.toISOString()} - ${e.type} (reason: ${e.reason.substring(0, 50)}...)`);
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
})();
