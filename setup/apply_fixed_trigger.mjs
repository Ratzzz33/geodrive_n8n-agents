#!/usr/bin/env node

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false },
  connect_timeout: 10
});

try {
  console.log('🔧 Применение исправленного trigger для bookings...\n');
  
  // Читаем SQL миграцию
  const migrationSql = readFileSync(
    join(process.cwd(), 'setup/migrations/0039_fix_booking_trigger.sql'),
    'utf8'
  );
  
  // Применяем миграцию
  await sql.unsafe(migrationSql);
  
  console.log('✅ Миграция успешно применена!\n');
  console.log('📋 Что изменилось:\n');
  console.log('1. ❌ Удален старый trigger process_booking_nested_entities_trigger');
  console.log('   (он падал с ошибкой и очищал data)');
  console.log('');
  console.log('2. ✅ Создан новый trigger link_booking_entities_trigger');
  console.log('   Что он делает:');
  console.log('   - Извлекает car_id и client_id из data (числа)');
  console.log('   - Ищет соответствующие UUID через external_refs');
  console.log('   - Устанавливает bookings.car_id и bookings.client_id (UUID)');
  console.log('   - НЕ очищает data (сохраняет все 180+ полей)');
  console.log('');
  console.log('3. ⚠️  ВАЖНО:');
  console.log('   Trigger связывает только СУЩЕСТВУЮЩИЕ cars/clients');
  console.log('   Если car/client НЕ существует в БД → связь НЕ создается');
  console.log('');
  console.log('📊 Текущая ситуация:');
  
  // Проверяем сколько cars и clients уже есть
  const carCount = await sql`SELECT COUNT(*) as count FROM cars`;
  const clientCount = await sql`SELECT COUNT(*) as count FROM clients`;
  const carRefsCount = await sql`
    SELECT COUNT(*) as count FROM external_refs 
    WHERE entity_type = 'car' AND system = 'rentprog'
  `;
  const clientRefsCount = await sql`
    SELECT COUNT(*) as count FROM external_refs 
    WHERE entity_type = 'client' AND system = 'rentprog'
  `;
  
  console.log(`   Cars в БД: ${carCount[0].count}`);
  console.log(`   Cars external_refs: ${carRefsCount[0].count}`);
  console.log(`   Clients в БД: ${clientCount[0].count}`);
  console.log(`   Clients external_refs: ${clientRefsCount[0].count}`);
  console.log('');
  
  if (carCount[0].count > 0 && clientCount[0].count > 0) {
    console.log('🎉 Cars и clients уже есть в БД!');
    console.log('   Следующий workflow execution автоматически свяжет брони');
  } else {
    console.log('⚠️  Cars и/или clients отсутствуют в БД!');
    console.log('   Нужно:');
    console.log('   1. Создать snapshot workflow для импорта cars из RentProg');
    console.log('   2. Создать snapshot workflow для импорта clients из RentProg');
    console.log('   3. После импорта брони автоматически свяжутся');
  }
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

