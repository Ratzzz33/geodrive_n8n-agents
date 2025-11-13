#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

console.log('\n🔍 Проверка триггеров на таблице bookings...\n');

// Получаем список триггеров
const triggers = await sql`
  SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
  FROM information_schema.triggers
  WHERE event_object_table = 'bookings'
`;

console.log(`📋 Найдено триггеров: ${triggers.length}\n`);

triggers.forEach((trigger, idx) => {
  console.log(`${idx + 1}. ${trigger.trigger_name}`);
  console.log(`   Событие: ${trigger.action_timing} ${trigger.event_manipulation}`);
  console.log(`   Действие: ${trigger.action_statement}\n`);
});

// Получаем определение функции триггера
if (triggers.length > 0) {
  console.log('📝 Определение функции триггера:\n');
  
  const funcDef = await sql`
    SELECT pg_get_functiondef(oid) as definition
    FROM pg_proc
    WHERE proname = 'process_booking_nested_entities'
  `;
  
  if (funcDef.length > 0) {
    console.log(funcDef[0].definition);
  }
}

await sql.end();

