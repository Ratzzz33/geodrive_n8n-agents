#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🧪 Тест прямой INSERT с data...\n');
  
  // Тестовые данные
  const testData = {
    id: 999999,
    client_id: 12345,
    car_id: 67890,
    test_field: 'test_value'
  };
  
  const testDataJson = JSON.stringify(testData);
  
  console.log('📝 Пробуем INSERT с data = JSONB...');
  
  // Пробуем INSERT напрямую с CAST
  const result = await sql`
    INSERT INTO bookings (
      rentprog_id,
      branch,
      client_name,
      car_name,
      total,
      deposit,
      rental_cost,
      data,
      payload_json
    )
    VALUES (
      'test_999999',
      'tbilisi',
      'Test Client',
      'Test Car',
      100,
      0,
      100,
      ${testDataJson}::jsonb,
      ${testDataJson}
    )
    ON CONFLICT (rentprog_id) DO UPDATE SET
      data = EXCLUDED.data,
      payload_json = EXCLUDED.payload_json,
      updated_at = NOW()
    RETURNING rentprog_id, data, jsonb_typeof(data) as data_type
  `;
  
  console.log('\n✅ INSERT выполнен');
  console.log(`   rentprog_id: ${result[0].rentprog_id}`);
  console.log(`   data_type: ${result[0].data_type}`);
  
  const dataKeys = Object.keys(result[0].data || {});
  console.log(`   data ключей: ${dataKeys.length}`);
  
  if (dataKeys.length > 0) {
    console.log(`   data->>'client_id': ${result[0].data.client_id}`);
    console.log(`   data->>'car_id': ${result[0].data.car_id}`);
    console.log('\n🎉 SUCCESS! Data заполнилось!');
  } else {
    console.log('\n❌ FAIL! Data пустой - triggers очистили его!');
    
    // Проверяем какой trigger сработал
    console.log('\n🔍 Проверка triggers...');
    const triggers = await sql`
      SELECT tgname
      FROM pg_trigger
      WHERE tgrelid = 'bookings'::regclass
      AND NOT tgisinternal
      AND tgname LIKE '%nested%'
    `;
    
    if (triggers.length > 0) {
      console.log(`   Проблемный trigger: ${triggers[0].tgname}`);
      console.log('   Этот trigger ОЧИЩАЕТ data после INSERT/UPDATE!');
    }
  }
  
  // Удаляем тестовую запись
  await sql`DELETE FROM bookings WHERE rentprog_id = 'test_999999'`;
  
} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

