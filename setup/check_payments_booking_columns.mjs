#!/usr/bin/env node
/**
 * Проверка: какие колонки для booking_id есть в payments
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

console.log('🔍 Проверяю колонки для booking в таблице payments...\n');

try {
  const columns = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'payments'
      AND (column_name LIKE '%booking%' OR column_name = 'rp_booking_id')
    ORDER BY column_name;
  `;
  
  console.log('📋 Колонки связанные с booking:');
  columns.forEach(col => {
    console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
  });
  
  const hasBookingId = columns.some(c => c.column_name === 'booking_id');
  const hasRpBookingId = columns.some(c => c.column_name === 'rp_booking_id');
  
  console.log('\n📊 Анализ:');
  console.log(`   booking_id (UUID): ${hasBookingId ? '✅ Есть' : '❌ Нет'}`);
  console.log(`   rp_booking_id (BIGINT): ${hasRpBookingId ? '✅ Есть' : '❌ Нет'}`);
  
  if (hasBookingId && hasRpBookingId) {
    console.log('\n✅ Обе колонки есть!');
    console.log('   booking_id - для UUID ссылок на bookings');
    console.log('   rp_booking_id - для RentProg IDs');
  } else if (hasBookingId && !hasRpBookingId) {
    console.log('\n❌ Проблема: rp_booking_id отсутствует!');
    console.log('   Нужно добавить: ALTER TABLE payments ADD COLUMN rp_booking_id BIGINT;');
  }
  
  console.log('\n💡 Решение для workflow:');
  console.log('   Вместо: booking_id = 509078 (INTEGER)');
  console.log('   Использовать: rp_booking_id = 509078 (BIGINT)');
  
} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

