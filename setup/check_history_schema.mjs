import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔍 Проверка структуры таблицы history\n');
  
  // Проверить структуру таблицы
  const columns = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'history'
    ORDER BY ordinal_position
  `;
  
  console.log('Колонки таблицы history:');
  columns.forEach(col => {
    console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
  });
  
  // Проверить несколько записей
  const samples = await sql`
    SELECT * FROM history LIMIT 3
  `;
  
  console.log('\n📝 Примеры записей:');
  samples.forEach((row, i) => {
    console.log(`\nЗапись ${i + 1}:`);
    console.log(JSON.stringify(row, null, 2));
  });
  
} catch (err) {
  console.error('❌ Ошибка:', err);
} finally {
  await sql.end();
}

