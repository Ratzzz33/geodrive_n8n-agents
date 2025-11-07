import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  // Получаем все таблицы связанные с RentProg
  const tables = await sql`
    SELECT table_name, 
           (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND column_name = 'data') as has_data_column
    FROM information_schema.tables t
    WHERE table_schema = 'public' 
      AND (table_name LIKE '%rentprog%' OR table_name LIKE 'rp_%')
    ORDER BY table_name
  `;
  
  console.log('📋 RentProg related tables:\n');
  
  for (const table of tables) {
    console.log(`   ${table.table_name}${table.has_data_column > 0 ? ' (has data column)' : ''}`);
    
    // Получаем структуру таблицы
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = ${table.table_name}
      ORDER BY ordinal_position
    `;
    
    const dataColumn = columns.find(c => c.column_name === 'data');
    if (dataColumn) {
      console.log(`      Columns: ${columns.map(c => c.column_name).join(', ')}`);
    }
    console.log('');
  }
  
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await sql.end();
}

