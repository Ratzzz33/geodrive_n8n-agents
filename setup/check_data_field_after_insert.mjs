#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkData() {
  const sql = postgres(CONNECTION_STRING, {max: 1, ssl: {rejectUnauthorized: false}});
  
  console.log('\n🔍 Проверка: что триггер делает с полем data\n');
  
  const testId = crypto.randomUUID();
  
  console.log('1. Вставка записи с data...');
  const inserted = await sql`
    INSERT INTO bookings(id, data)
    VALUES(
      ${testId}::uuid,
      '{"id":999999,"responsible_id":"99999","responsible":"Test Trigger"}'::jsonb
    )
    RETURNING id, data, responsible_id
  `.then(rows => rows[0]);
  
  console.log('   После вставки (до COMMIT):');
  console.log('  ', JSON.stringify(inserted, null, 2));
  
  console.log('\n2. Проверка через SELECT...');
  const selected = await sql`
    SELECT id, data, responsible_id 
    FROM bookings 
    WHERE id = ${testId}
  `.then(rows => rows[0]);
  
  console.log('   После SELECT:');
  console.log('  ', JSON.stringify(selected, null, 2));
  
  // Проверка сотрудника
  const employee = await sql`
    SELECT rentprog_id, name 
    FROM rentprog_employees 
    WHERE rentprog_id = '99999'
  `.then(rows => rows[0]);
  
  if (employee) {
    console.log('\n✅ Сотрудник создан:', employee.name);
  } else {
    console.log('\n❌ Сотрудник НЕ создан');
  }
  
  // Очистка
  await sql`DELETE FROM bookings WHERE id = ${testId}`;
  await sql`DELETE FROM rentprog_employees WHERE rentprog_id = '99999'`;
  await sql`DELETE FROM external_refs WHERE external_id = '99999' AND system = 'rentprog'`;
  
  await sql.end();
}

checkData();

