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
      WHERE table_name = 'rentprog_employee'
    ) as exists
  `;
  
  console.log('Table rentprog_employee exists:', tableExists[0].exists);
  
  if (tableExists[0].exists) {
    // Если таблица есть, смотрим данные
    const count = await sql`SELECT COUNT(*) as count FROM rentprog_employee`;
    console.log('Records count:', count[0].count);
    
    const sample = await sql`SELECT * FROM rentprog_employee LIMIT 5`;
    console.log('\nSample data:');
    sample.forEach((row, i) => {
      console.log(`\n[${i + 1}]`, JSON.stringify(row, null, 2));
    });
    
    // Проверяем уникальные user_id
    const uniqueUsers = await sql`
      SELECT COUNT(DISTINCT user_id) as count 
      FROM rentprog_employee 
      WHERE user_id IS NOT NULL
    `;
    console.log(`\nUnique user_id: ${uniqueUsers[0].count}`);
  }
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await sql.end();
}

