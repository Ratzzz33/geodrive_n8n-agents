import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

try {
  const columns = await sql`
    SELECT column_name, data_type, character_maximum_length
    FROM information_schema.columns
    WHERE table_name = 'cars'
    ORDER BY ordinal_position
  `;
  
  console.log('\n📋 Структура таблицы cars:\n');
  columns.forEach(col => {
    const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
    console.log(`  ${col.column_name}: ${col.data_type}${length}`);
  });
  
  console.log(`\n✅ Всего полей: ${columns.length}\n`);
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
} finally {
  await sql.end();
}

