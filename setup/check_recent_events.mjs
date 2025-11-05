import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    console.log('📊 Последние события за 2 часа:\n');
    
    const events = await sql`
      SELECT id, ts, type, rentprog_id, company_id, ok, processed
      FROM events 
      WHERE ts > NOW() - INTERVAL '2 hours'
      ORDER BY ts DESC
      LIMIT 10
    `;
    
    if (events.length === 0) {
      console.log('⚠️  Нет событий за последние 2 часа');
    } else {
      events.forEach((e, idx) => {
        console.log(`${idx + 1}. ID:${e.id} ${e.ts.toISOString()} type:${e.type} rentprog_id:${e.rentprog_id} company:${e.company_id} processed:${e.processed}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
})();

