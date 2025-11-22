#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false },
  connect_timeout: 10
});

try {
  console.log('🧪 Тестирование trigger напрямую...\n');
  
  // Создаем тестовую запись с data
  const testData = {
    id: 999999,
    car_id: 12345,
    client_id: 67890,
    total: 500,
    deposit: 100,
    state: 'Test'
  };
  
  console.log('📝 Вставляем тестовую бронь с data...');
  console.log('Test data:', JSON.stringify(testData));
  
  const result = await sql`
    INSERT INTO bookings (
      rentprog_id,
      number,
      branch,
      data
    ) VALUES (
      'TEST_TRIGGER_999',
      99999,
      'tbilisi',
      ${sql.json(testData)}
    )
    ON CONFLICT (rentprog_id) DO UPDATE SET
      data = EXCLUDED.data,
      updated_at = NOW()
    RETURNING rentprog_id, data, car_id, client_id;
  `;
  
  console.log('\n✅ Результат INSERT:');
  console.log('   rentprog_id:', result[0].rentprog_id);
  console.log('   data:', result[0].data);
  console.log('   car_id (UUID):', result[0].car_id);
  console.log('   client_id (UUID):', result[0].client_id);
  
  if (!result[0].data || Object.keys(result[0].data).length === 0) {
    console.log('\n❌ FAIL! Trigger ОЧИСТИЛ data!');
  } else {
    console.log('\n✅ SUCCESS! Trigger НЕ очистил data!');
    console.log(`   data имеет ${Object.keys(result[0].data).length} ключей`);
  }
  
  // Удаляем тестовую запись
  await sql`DELETE FROM bookings WHERE rentprog_id = 'TEST_TRIGGER_999'`;
  console.log('\n🧹 Тестовая запись удалена');
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
} finally {
  await sql.end();
}

