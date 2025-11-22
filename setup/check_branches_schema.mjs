import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

try {
  const columns = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'branches'
    ORDER BY ordinal_position
  `;
  
  console.log('\n📋 Структура таблицы branches:\n');
  columns.forEach(col => {
    console.log(`  ${col.column_name}: ${col.data_type}`);
  });
  
  console.log('\n');
  
  const branches = await sql`SELECT * FROM branches LIMIT 5`;
  console.log('🔍 Пример данных:');
  console.log(branches);
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
} finally {
  await sql.end();
}

