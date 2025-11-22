import postgres from 'postgres';

const sql = postgres(
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
  { max: 1, ssl: { rejectUnauthorized: false }, connect_timeout: 5 }
);

async function checkStatus() {
  try {
    const result = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN rentprog_id IS NOT NULL THEN 1 END) as with_id
      FROM clients
    `;
    
    const total = Number(result[0].total);
    const withId = Number(result[0].with_id);
    const percent = total > 0 ? ((withId / total) * 100).toFixed(1) : 0;
    
    console.log('');
    console.log('📊 Статус импорта:');
    console.log(`   👥 Всего клиентов в БД: ${total}`);
    console.log(`   ✅ С rentprog_id: ${withId} (${percent}%)`);
    console.log(`   📈 Ожидается: ~8550 клиентов`);
    console.log('');
    
    if (withId >= 8000) {
      console.log('🎉 Импорт завершён!');
    } else if (withId > 2691) {
      console.log('⏳ Импорт в процессе...');
    } else {
      console.log('⚠️  Импорт ещё не начался или не запущен');
    }
    
  } catch (err) {
    console.error('❌ Ошибка:', err.message);
  } finally {
    await sql.end();
  }
}

checkStatus();

