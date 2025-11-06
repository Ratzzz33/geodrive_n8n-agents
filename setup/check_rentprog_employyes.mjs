import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  // Проверяем существование таблицы
  const tableExists = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'rentprog_employyes'
    ) as exists
  `;
  
  console.log('Table rentprog_employyes exists:', tableExists[0].exists);
  
  if (tableExists[0].exists) {
    // Если таблица есть, смотрим данные
    const count = await sql`SELECT COUNT(*) as count FROM rentprog_employyes`;
    console.log('Records count:', count[0].count);
    
    // Структура таблицы
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'rentprog_employyes'
      ORDER BY ordinal_position
    `;
    
    console.log('\nTable structure:');
    columns.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
    
    const sample = await sql`SELECT * FROM rentprog_employyes LIMIT 3`;
    console.log('\nSample data:');
    sample.forEach((row, i) => {
      console.log(`\n[${i + 1}]`, JSON.stringify(row, null, 2));
    });
    
    // Проверяем связь с employees через external_refs
    const linkedCount = await sql`
      SELECT COUNT(*) as count
      FROM external_refs
      WHERE entity_type = 'employee' AND system = 'rentprog'
    `;
    console.log(`\nLinked in external_refs: ${linkedCount[0].count}`);
  }
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await sql.end();
}

