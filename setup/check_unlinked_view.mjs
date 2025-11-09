import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('📋 Структура view unlinked_records:\n');
  
  const cols = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'unlinked_records'
    ORDER BY ordinal_position
  `;
  
  cols.forEach(c => {
    console.log(`  - ${c.column_name}: ${c.data_type}`);
  });
  
  console.log('\n📊 Пример данных из view:\n');
  
  const sample = await sql`SELECT * FROM unlinked_records LIMIT 3`;
  
  if (sample.length === 0) {
    console.log('  (пусто)');
  } else {
    sample.forEach((row, i) => {
      console.log(`Row ${i + 1}:`, JSON.stringify(row, null, 2));
    });
  }
  
} catch (err) {
  console.error('❌ Ошибка:', err.message);
} finally {
  await sql.end();
}

