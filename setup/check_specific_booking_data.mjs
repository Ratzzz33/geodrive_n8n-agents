#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔍 Проверка конкретных броней после execution 25137...\n');
  
  // Execution 25137 был в 13:52:16 - 13:52:45
  // Ищем брони обновленные в это время
  
  const bookingsFromExecution = await sql`
    SELECT 
      rentprog_id,
      number,
      client_name,
      car_name,
      total,
      data,
      payload_json IS NOT NULL as has_payload_json,
      LENGTH(payload_json::text) as payload_json_length,
      updated_at
    FROM bookings
    WHERE updated_at BETWEEN '2025-11-20 13:52:00'::timestamptz AND '2025-11-20 13:53:00'::timestamptz
    ORDER BY updated_at DESC
    LIMIT 5
  `;
  
  if (bookingsFromExecution.length === 0) {
    console.log('⚠️  Не найдено броней, обновленных во время execution 25137');
    console.log('   Проверю последние обновленные брони...\n');
    
    const latestBookings = await sql`
      SELECT 
        rentprog_id,
        number,
        client_name,
        car_name,
        total,
        data,
        payload_json IS NOT NULL as has_payload_json,
        LENGTH(payload_json::text) as payload_json_length,
        updated_at
      FROM bookings
      ORDER BY updated_at DESC
      LIMIT 3
    `;
    
    console.log(`📊 Последние 3 брони в БД:\n`);
    
    latestBookings.forEach((b, idx) => {
      console.log(`${idx + 1}. Бронь ${b.rentprog_id} (№${b.number})`);
      console.log(`   Обновлена: ${b.updated_at}`);
      console.log(`   Клиент: ${b.client_name}`);
      console.log(`   Машина: ${b.car_name}`);
      console.log(`   Total: ${b.total}`);
      console.log(`   payload_json: ${b.has_payload_json ? `✅ есть (${b.payload_json_length} символов)` : '❌ нет'}`);
      
      const dataKeys = Object.keys(b.data || {});
      console.log(`   data (JSONB): ${dataKeys.length} ключей`);
      
      if (dataKeys.length > 0) {
        console.log(`     ✅ client_id: ${b.data.client_id || 'NULL'}`);
        console.log(`     ✅ car_id: ${b.data.car_id || 'NULL'}`);
        console.log(`     ✅ first_name: ${b.data.first_name || 'NULL'}`);
        console.log(`     Примеры ключей: ${dataKeys.slice(0, 5).join(', ')}`);
      } else {
        console.log(`     ❌ ПУСТО`);
      }
      console.log('');
    });
    
  } else {
    console.log(`📊 Найдено ${bookingsFromExecution.length} броней из execution 25137:\n`);
    
    bookingsFromExecution.forEach((b, idx) => {
      console.log(`${idx + 1}. Бронь ${b.rentprog_id} (№${b.number})`);
      console.log(`   Обновлена: ${b.updated_at}`);
      console.log(`   Клиент: ${b.client_name}`);
      console.log(`   Машина: ${b.car_name}`);
      console.log(`   Total: ${b.total}`);
      console.log(`   payload_json: ${b.has_payload_json ? `✅ есть (${b.payload_json_length} символов)` : '❌ нет'}`);
      
      const dataKeys = Object.keys(b.data || {});
      console.log(`   data (JSONB): ${dataKeys.length} ключей`);
      
      if (dataKeys.length > 0) {
        console.log(`     ✅ client_id: ${b.data.client_id || 'NULL'}`);
        console.log(`     ✅ car_id: ${b.data.car_id || 'NULL'}`);
        console.log(`     ✅ first_name: ${b.data.first_name || 'NULL'}`);
        console.log(`     ✅ last_name: ${b.data.last_name || 'NULL'}`);
        console.log(`     Примеры ключей: ${dataKeys.slice(0, 10).join(', ')}`);
        console.log(`     Всего ключей: ${dataKeys.length}`);
      } else {
        console.log(`     ❌ ПУСТО`);
      }
      console.log('');
    });
  }
  
  // Финальная проверка
  console.log('\n🎯 Итоговая проверка:');
  
  const stats = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN jsonb_typeof(data) = 'object' AND data != '{}'::jsonb THEN 1 END) as has_data,
      COUNT(CASE WHEN payload_json IS NOT NULL THEN 1 END) as has_payload_json
    FROM bookings
    WHERE updated_at > NOW() - INTERVAL '1 hour'
  `;
  
  const s = stats[0];
  console.log(`Брони за последний час: ${s.total}`);
  console.log(`  data заполнено: ${s.has_data} (${(s.has_data / s.total * 100).toFixed(1)}%)`);
  console.log(`  payload_json заполнено: ${s.has_payload_json} (${(s.has_payload_json / s.total * 100).toFixed(1)}%)`);
  
  if (s.has_data > 0) {
    console.log('\n✅ УСПЕХ: Поле data теперь заполняется!');
  } else {
    console.log('\n❌ ПРОБЛЕМА: Поле data все еще пусто');
  }
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

