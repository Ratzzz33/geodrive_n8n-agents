import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  const count = await sql`SELECT COUNT(*) as count FROM rentprog_employees`;
  console.log('Records in rentprog_employees:', count[0].count);
  
  // Структура таблицы
  const columns = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'rentprog_employees'
    ORDER BY ordinal_position
  `;
  
  console.log('\nTable structure:');
  columns.forEach(col => {
    console.log(`  ${col.column_name}: ${col.data_type}`);
  });
  
  const sample = await sql`SELECT * FROM rentprog_employees LIMIT 3`;
  console.log('\nSample data:');
  sample.forEach((row, i) => {
    console.log(`\n[${i + 1}] rentprog_id:`, row.rentprog_id);
    console.log('   name:', row.name);
    console.log('   first_name:', row.first_name);
    console.log('   last_name:', row.last_name);
    console.log('   company_id:', row.company_id);
    console.log('   data keys:', row.data ? Object.keys(row.data).join(', ') : 'N/A');
  });
  
  // Проверяем связь с employees через external_refs
  const linkedCount = await sql`
    SELECT COUNT(*) as count
    FROM external_refs
    WHERE entity_type = 'employee' AND system = 'rentprog'
  `;
  console.log(`\n\nLinked in external_refs (employee): ${linkedCount[0].count}`);
  
  // Проверяем записи в employees
  const employeesCount = await sql`SELECT COUNT(*) as count FROM employees`;
  console.log(`Records in employees table: ${employeesCount[0].count}`);
  
  // Уникальные rentprog_id
  const uniqueIds = await sql`
    SELECT COUNT(DISTINCT rentprog_id) as count 
    FROM rentprog_employees 
    WHERE rentprog_id IS NOT NULL
  `;
  console.log(`\nUnique rentprog_id: ${uniqueIds[0].count}`);
  
  // Уникальные company_id (филиалы)
  const branches = await sql`
    SELECT company_id, COUNT(*) as count
    FROM rentprog_employees
    WHERE company_id IS NOT NULL
    GROUP BY company_id
    ORDER BY company_id
  `;
  console.log('\nEmployees by branch (company_id):');
  branches.forEach(b => {
    console.log(`  company_id ${b.company_id}: ${b.count} employees`);
  });
  
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await sql.end();
}

