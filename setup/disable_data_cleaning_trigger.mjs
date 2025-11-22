#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false },
  connect_timeout: 10
});

try {
  console.log('⚠️  Отключение trigger который очищает data...\n');
  
  // Отключаем проблемный trigger
  await sql`
    ALTER TABLE bookings DISABLE TRIGGER trg_fill_bookings_from_jsonb;
  `;
  
  console.log('✅ Trigger trg_fill_bookings_from_jsonb ОТКЛЮЧЕН\n');
  console.log('📋 Почему:');
  console.log('   - Этот trigger очищал data после извлечения полей');
  console.log('   - data должен быть ИСТОЧНИКОМ ИСТИНЫ (180+ полей из RentProg)');
  console.log('   - Все поля уже заполняются в n8n (Process All Bookings)');
  console.log('');
  console.log('🎯 Теперь data будет сохраняться со всеми полями!');
  console.log('');
  console.log('📊 Активные triggers на bookings:');
  
  const triggers = await sql`
    SELECT tgname AS trigger_name, tgenabled AS enabled
    FROM pg_trigger
    WHERE tgrelid = 'bookings'::regclass
      AND tgisinternal = false
    ORDER BY tgname;
  `;
  
  triggers.forEach(t => {
    const status = t.enabled === 'O' ? '✅ Enabled' : '❌ Disabled';
    console.log(`   ${t.trigger_name}: ${status}`);
  });
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

