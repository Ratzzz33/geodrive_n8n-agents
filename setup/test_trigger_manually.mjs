#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🧪 Тестирование trigger вручную...\n');
  
  // Находим одну бронь с payload_json
  const booking = await sql`
    SELECT rentprog_id, payload_json, data
    FROM bookings
    WHERE payload_json IS NOT NULL
    LIMIT 1
  `;
  
  if (booking.length === 0) {
    console.log('❌ Нет броней с payload_json');
    process.exit(1);
  }
  
  const b = booking[0];
  console.log(`📋 Тестируем на брони ${b.rentprog_id}`);
  console.log(`   payload_json длина: ${b.payload_json.length} символов`);
  console.log(`   data (до UPDATE): ${JSON.stringify(b.data).slice(0, 50)}...`);
  
  // Пробуем UPDATE (trigger должен сработать)
  console.log('\n🔄 Делаем UPDATE брони (trigger должен заполнить data)...');
  
  await sql`
    UPDATE bookings
    SET updated_at = NOW()
    WHERE rentprog_id = ${b.rentprog_id}
  `;
  
  // Проверяем результат
  const updated = await sql`
    SELECT 
      rentprog_id,
      data,
      jsonb_typeof(data) as data_type,
      data->>'client_id' as client_id,
      data->>'car_id' as car_id
    FROM bookings
    WHERE rentprog_id = ${b.rentprog_id}
  `;
  
  const u = updated[0];
  console.log('\n✅ После UPDATE:');
  console.log(`   data_type: ${u.data_type}`);
  console.log(`   data->>'client_id': ${u.client_id || 'NULL'}`);
  console.log(`   data->>'car_id': ${u.car_id || 'NULL'}`);
  
  const dataKeys = Object.keys(u.data || {});
  console.log(`   Ключей в data: ${dataKeys.length}`);
  
  if (dataKeys.length > 0) {
    console.log(`   Примеры ключей: ${dataKeys.slice(0, 10).join(', ')}`);
    console.log('\n🎉 TRIGGER РАБОТАЕТ!');
  } else {
    console.log('\n❌ TRIGGER НЕ СРАБОТАЛ - data все еще пустой');
    
    // Проверим trigger существует
    const triggers = await sql`
      SELECT tgname, tgenabled
      FROM pg_trigger
      WHERE tgrelid = 'bookings'::regclass
      AND tgname = 'auto_populate_data_trigger'
    `;
    
    if (triggers.length > 0) {
      console.log(`\n⚠️  Trigger ${triggers[0].tgname} существует, статус: ${triggers[0].tgenabled}`);
    } else {
      console.log('\n❌ Trigger НЕ НАЙДЕН!');
    }
  }
  
} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  console.error(error.stack);
  process.exit(1);
} finally {
  await sql.end();
}

