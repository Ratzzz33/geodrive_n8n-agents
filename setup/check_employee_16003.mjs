#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function check() {
  const sql = postgres(CONNECTION_STRING, {max: 1, ssl: {rejectUnauthorized: false}});
  
  console.log('\n🔍 Проверка сотрудника 16003\n');
  
  // В rentprog_employees
  const employee = await sql`
    SELECT id, rentprog_id, name 
    FROM rentprog_employees 
    WHERE rentprog_id = '16003'
  `.then(rows => rows[0]);
  
  if (employee) {
    console.log('✅ Найден в rentprog_employees:');
    console.log(`   UUID: ${employee.id}`);
    console.log(`   RentProg ID: ${employee.rentprog_id}`);
    console.log(`   Name: ${employee.name}`);
    
    // В external_refs
    const extRef = await sql`
      SELECT * 
      FROM external_refs 
      WHERE entity_id = ${employee.id} 
        AND system = 'rentprog'
    `.then(rows => rows[0]);
    
    if (extRef) {
      console.log('\n✅ Найден в external_refs:');
      console.log(`   entity_type: ${extRef.entity_type}`);
      console.log(`   external_id: ${extRef.external_id}`);
    } else {
      console.log('\n❌ НЕ найден в external_refs!');
      console.log('   Создаём запись...\n');
      
      await sql`
        INSERT INTO external_refs (entity_type, entity_id, system, external_id)
        VALUES ('rentprog_employee', ${employee.id}, 'rentprog', '16003')
      `;
      
      console.log('✅ Создано!');
    }
  } else {
    console.log('❌ Сотрудник НЕ найден в rentprog_employees!');
  }
  
  await sql.end();
}

check();

