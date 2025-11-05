import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    const rows = await sql`
      SELECT id, ts, type, rentprog_id, company_id, ok, processed, reason
      FROM events 
      WHERE ts > NOW() - INTERVAL '2 minutes'
      ORDER BY ts DESC 
      LIMIT 1
    `;
    
    if (rows.length === 0) {
      console.log('⚠️  Нет событий за последние 2 минуты');
    } else {
      const e = rows[0];
      console.log('✅ Последнее событие в БД:');
      console.log(`   ID: ${e.id}`);
      console.log(`   Время: ${e.ts.toISOString()}`);
      console.log(`   Тип: ${e.type}`);
      console.log(`   RentProg ID: ${e.rentprog_id}`);
      console.log(`   Company ID: ${e.company_id}`);
      console.log(`   OK: ${e.ok}`);
      console.log(`   Processed: ${e.processed}`);
      if (e.reason) {
        console.log(`   Reason: ${e.reason.substring(0, 100)}`);
      }
    }
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
})();

