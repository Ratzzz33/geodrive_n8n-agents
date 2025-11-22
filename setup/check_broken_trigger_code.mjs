#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false },
  connect_timeout: 10
});

try {
  console.log('🔍 Проверка кода trigger process_booking_nested_entities...\n');
  
  // Получаем определение функции trigger
  const triggerFunc = await sql`
    SELECT pg_get_functiondef(oid) as definition
    FROM pg_proc
    WHERE proname = 'process_booking_nested_entities'
    LIMIT 1;
  `;
  
  if (triggerFunc.length === 0) {
    console.log('❌ Функция process_booking_nested_entities не найдена');
  } else {
    console.log('📋 Код функции trigger:\n');
    console.log(triggerFunc[0].definition);
  }
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

