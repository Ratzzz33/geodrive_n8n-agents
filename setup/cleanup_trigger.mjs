#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🧹 Удаление ненужного trigger...\n');
  
  // Удаляем trigger
  await sql`DROP TRIGGER IF EXISTS auto_populate_data_trigger ON bookings`;
  
  // Удаляем функцию
  await sql`DROP FUNCTION IF EXISTS auto_populate_data_from_payload_json()`;
  
  console.log('✅ Trigger и функция удалены');
  console.log('   Теперь data заполняется через executeQuery в n8n');
  console.log('   Конфликтов с другими triggers больше нет!');
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

