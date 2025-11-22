#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🧪 Простой тест INSERT...\n');
  
  const testData = JSON.stringify({ test: 'value', client_id: 12345 });
  
  // Удаляем если уже есть
  await sql`DELETE FROM bookings WHERE rentprog_id = 'test_simple'`;
  
  // INSERT с минимумом полей
  await sql`
    INSERT INTO bookings (
      rentprog_id,
      branch,
      total,
      data,
      payload_json
    )
    VALUES (
      'test_simple',
      'tbilisi',
      100,
      ${testData}::jsonb,
      ${testData}
    )
  `;
  
  console.log('✅ INSERT выполнен');
  
  // Читаем обратно
  const result = await sql`
    SELECT 
      rentprog_id,
      data,
      data->>'test' as test_value,
      data->>'client_id' as client_id_value
    FROM bookings
    WHERE rentprog_id = 'test_simple'
  `;
  
  const r = result[0];
  console.log(`\n📊 Результат:`);
  console.log(`   rentprog_id: ${r.rentprog_id}`);
  console.log(`   data: ${JSON.stringify(r.data)}`);
  console.log(`   data->>'test': ${r.test_value}`);
  console.log(`   data->>'client_id': ${r.client_id_value}`);
  
  const dataKeys = Object.keys(r.data || {});
  if (dataKeys.length > 0) {
    console.log('\n🎉 SUCCESS! Data заполнилось!');
  } else {
    console.log('\n❌ FAIL! Data пустой!');
  }
  
  // Удаляем тестовую запись
  await sql`DELETE FROM bookings WHERE rentprog_id = 'test_simple'`;
  
} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  console.error(error);
} finally {
  await sql.end();
}

