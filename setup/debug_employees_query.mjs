#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function debugQuery() {
  const sql = postgres(CONNECTION_STRING, {max: 1, ssl: {rejectUnauthorized: false}});
  
  console.log('\n🔍 Отладка SQL запроса для workflow\n');
  
  try {
    // Точно такой же запрос, как в workflow
    console.log('📝 SQL запрос из workflow:');
    console.log(`SELECT 
  re.id as employee_id,
  re.name as employee_name,
  COALESCE(re.cash_gel, 0) as cash_gel,
  COALESCE(re.cash_usd, 0) as cash_usd,
  COALESCE(re.cash_eur, 0) as cash_eur,
  re.rentprog_id
FROM rentprog_employees re
WHERE re.rentprog_id IS NOT NULL
ORDER BY re.name\n`);
    
    const result = await sql`
      SELECT 
        re.id as employee_id,
        re.name as employee_name,
        COALESCE(re.cash_gel, 0) as cash_gel,
        COALESCE(re.cash_usd, 0) as cash_usd,
        COALESCE(re.cash_eur, 0) as cash_eur,
        re.rentprog_id
      FROM rentprog_employees re
      WHERE re.rentprog_id IS NOT NULL
      ORDER BY re.name
    `;
    
    console.log(`\n✅ Результат: ${result.length} записей\n`);
    
    if (result.length > 0) {
      console.log('📊 Первые 3 записи:');
      result.slice(0, 3).forEach(emp => {
        console.log(`   ${emp.employee_name} (ID: ${emp.rentprog_id})`);
        console.log(`   Касса: GEL ${emp.cash_gel}, USD ${emp.cash_usd}, EUR ${emp.cash_eur}`);
        console.log(`   UUID: ${emp.employee_id}\n`);
      });
    } else {
      console.log('❌ Записей НЕТ!\n');
      
      // Проверка 1: Есть ли записи в rentprog_employees вообще?
      const total = await sql`SELECT COUNT(*) as count FROM rentprog_employees`;
      console.log(`   Всего записей в rentprog_employees: ${total[0].count}`);
      
      // Проверка 2: Есть ли записи с rentprog_id IS NOT NULL?
      const withId = await sql`SELECT COUNT(*) as count FROM rentprog_employees WHERE rentprog_id IS NOT NULL`;
      console.log(`   С rentprog_id IS NOT NULL: ${withId[0].count}`);
      
      // Проверка 3: Какие значения rentprog_id есть?
      const ids = await sql`SELECT DISTINCT rentprog_id FROM rentprog_employees LIMIT 10`;
      console.log(`\n   Примеры rentprog_id:`);
      ids.forEach(row => console.log(`     - ${row.rentprog_id}`));
    }
    
  } finally {
    await sql.end();
  }
}

debugQuery();

