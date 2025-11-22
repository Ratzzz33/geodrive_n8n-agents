#!/usr/bin/env node

import { readFileSync } from 'fs';
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🚀 Применение миграции 0038_auto_populate_data_from_payload_json.sql...\n');
  
  // Читаем SQL файл
  const migrationSQL = readFileSync('setup/migrations/0038_auto_populate_data_from_payload_json.sql', 'utf-8');
  
  // Выполняем миграцию
  await sql.unsafe(migrationSQL);
  
  console.log('\n✅ Миграция успешно применена!');
  console.log('\n📊 Проверка результата:');
  
  // Проверяем результат
  const stats = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN data IS NOT NULL AND data != '{}'::jsonb THEN 1 END) as has_data,
      COUNT(CASE WHEN payload_json IS NOT NULL THEN 1 END) as has_payload_json
    FROM bookings
  `;
  
  const s = stats[0];
  console.log(`  Всего броней: ${s.total}`);
  console.log(`  С payload_json: ${s.has_payload_json} (${(s.has_payload_json / s.total * 100).toFixed(1)}%)`);
  console.log(`  С data (JSONB): ${s.has_data} (${(s.has_data / s.total * 100).toFixed(1)}%)`);
  
  // Примеры
  console.log('\n📋 Примеры заполненных броней:');
  
  const examples = await sql`
    SELECT 
      rentprog_id,
      client_name,
      data->>'client_id' as rp_client_id,
      data->>'car_id' as rp_car_id,
      jsonb_object_keys(data) as key_count
    FROM bookings
    WHERE data IS NOT NULL AND data != '{}'::jsonb
    LIMIT 3
  `;
  
  if (examples.length > 0) {
    // Подсчитываем ключи для первой брони
    const firstBooking = examples[0];
    const keys = await sql`
      SELECT COUNT(*) as count
      FROM bookings, jsonb_object_keys(data) as keys
      WHERE rentprog_id = ${firstBooking.rentprog_id}
    `;
    
    console.log(`  1. Бронь ${firstBooking.rentprog_id}: ${firstBooking.client_name}`);
    console.log(`     data->>'client_id': ${firstBooking.rp_client_id || 'NULL'}`);
    console.log(`     data->>'car_id': ${firstBooking.rp_car_id || 'NULL'}`);
    console.log(`     Ключей в data: ${keys[0].count}`);
  }
  
  console.log('\n🎯 Теперь при каждом INSERT/UPDATE броней:');
  console.log('   payload_json (TEXT) автоматически преобразуется → data (JSONB)');
  console.log('   через trigger auto_populate_data_from_payload_json()');
  
} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  console.error(error.stack);
  process.exit(1);
} finally {
  await sql.end();
}

