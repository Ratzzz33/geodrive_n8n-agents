#!/usr/bin/env node
/**
 * Применение миграции для добавления полей технических броней
 */

import postgres from 'postgres';
import fs from 'fs/promises';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

console.log('\n🔧 Применение миграции: добавление полей технических броней...\n');

try {
  // Читаем SQL файл
  const migrationSQL = await fs.readFile('setup/add_technical_booking_fields.sql', 'utf-8');
  
  // Выполняем миграцию
  await sql.unsafe(migrationSQL);
  
  console.log('\n✅ Миграция успешно применена!\n');
  
  // Проверяем результат
  const stats = await sql`
    SELECT 
      COUNT(*) FILTER (WHERE is_technical = TRUE) as technical_count,
      COUNT(*) FILTER (WHERE technical_type = 'technical_repair') as repair_count,
      COUNT(*) FILTER (WHERE technical_type = 'technical') as service_count,
      COUNT(*) as total
    FROM bookings
  `;
  
  console.log('📊 Статистика броней:\n');
  console.log(`   Всего: ${stats[0].total}`);
  console.log(`   Технических: ${stats[0].technical_count}`);
  console.log(`   - Для ремонта: ${stats[0].repair_count}`);
  console.log(`   - Служебных: ${stats[0].service_count}`);
  console.log(`   Обычных: ${stats[0].total - stats[0].technical_count}\n`);
  
} catch (error) {
  console.error('❌ Ошибка миграции:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

