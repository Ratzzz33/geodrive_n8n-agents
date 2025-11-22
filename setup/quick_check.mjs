import postgres from 'postgres';

const sql = postgres(
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
  { max: 1, ssl: { rejectUnauthorized: false }, connect_timeout: 10 }
);

try {
  const result = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN rentprog_id IS NOT NULL THEN 1 END) as with_id
    FROM clients
  `;
  
  const total = Number(result[0].total);
  const withId = Number(result[0].with_id);
  const percent = ((withId / total) * 100).toFixed(1);
  
  console.log('');
  console.log('📊 Статистика БД:');
  console.log(`   👥 Всего клиентов: ${total}`);
  console.log(`   ✅ С rentprog_id: ${withId} (${percent}%)`);
  console.log('');
  
  await sql.end();
} catch (err) {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
}
