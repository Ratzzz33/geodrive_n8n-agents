#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔍 Все triggers на таблице bookings:\n');
  
  const triggers = await sql`
    SELECT 
      tgname,
      tgtype,
      tgenabled,
      pg_get_triggerdef(oid) as definition
    FROM pg_trigger
    WHERE tgrelid = 'bookings'::regclass
    AND NOT tgisinternal
    ORDER BY tgname
  `;
  
  triggers.forEach(t => {
    console.log(`📌 ${t.tgname}`);
    console.log(`   Тип: ${t.tgtype} (${t.tgtype & 2 ? 'BEFORE' : 'AFTER'} ${t.tgtype & 4 ? 'INSERT' : ''}${t.tgtype & 8 ? ' UPDATE' : ''}${t.tgtype & 16 ? ' DELETE' : ''})`);
    console.log(`   Статус: ${t.tgenabled}`);
    console.log(`   Определение: ${t.definition.slice(0, 150)}...`);
    console.log('');
  });
  
  console.log('\n⚠️  ПРОБЛЕМА:');
  console.log('   Trigger process_booking_nested_entities_trigger срабатывает ПОСЛЕ');
  console.log('   и ОЧИЩАЕТ data, удаляя все что заполнил auto_populate_data_trigger!');
  
  console.log('\n💡 РЕШЕНИЕ:');
  console.log('   1. Удалить trigger auto_populate_data_from_payload_json (он не работает)');
  console.log('   2. Использовать executeQuery вместо upsert в n8n');
  console.log('   3. Или отключить process_booking_nested_entities_trigger временно');
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

