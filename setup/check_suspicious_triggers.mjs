#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false },
  connect_timeout: 10
});

try {
  console.log('🔍 Проверка подозрительных функций triggers...\n');
  
  const functions = [
    'sync_booking_fields',
    'fill_bookings_from_jsonb',
    'set_booking_car_id_from_rentprog'
  ];
  
  for (const funcName of functions) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📋 Функция: ${funcName}`);
    console.log('='.repeat(80));
    
    const result = await sql`
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc
      WHERE proname = ${funcName}
      LIMIT 1;
    `;
    
    if (result.length === 0) {
      console.log('❌ Функция не найдена');
    } else {
      console.log(result[0].definition);
      
      // Проверяем наличие строки очистки data
      if (result[0].definition.includes("NEW.data := '{}'")) {
        console.log('\n❌❌❌ НАЙДЕНА ОЧИСТКА DATA! ❌❌❌');
      } else if (result[0].definition.includes('NEW.data :=')) {
        console.log('\n⚠️  Функция МОДИФИЦИРУЕТ data!');
      } else {
        console.log('\n✅ Функция НЕ трогает data');
      }
    }
  }
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

