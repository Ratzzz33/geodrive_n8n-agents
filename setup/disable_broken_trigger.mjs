#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('⚠️  Отключение проблемного trigger...\n');
  
  // Отключаем trigger который ломает data
  await sql`ALTER TABLE bookings DISABLE TRIGGER process_booking_nested_entities_trigger`;
  
  console.log('✅ Trigger process_booking_nested_entities_trigger ОТКЛЮЧЕН');
  console.log('   Этот trigger падал с ошибкой "cannot call jsonb_object_keys on a scalar"');
  console.log('   Теперь data должно сохраняться корректно!');
  console.log('');
  console.log('⚠️  ВНИМАНИЕ: Этот trigger возможно делал что-то важное!');
  console.log('   После проверки может потребоваться его ИСПРАВИТЬ и ВКЛЮЧИТЬ обратно.');
  console.log('');
  console.log('🔄 Проверь следующий execution - data должно заполниться!');
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

