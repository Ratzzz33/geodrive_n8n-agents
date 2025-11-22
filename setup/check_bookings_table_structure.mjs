#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔍 Проверка структуры таблицы bookings...\n');
  
  // Получаем информацию о колонках таблицы bookings
  const columns = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'bookings'
    ORDER BY ordinal_position
  `;
  
  console.log(`📋 Колонки таблицы bookings (всего: ${columns.length}):\n`);
  
  columns.forEach(col => {
    const nullable = col.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)';
    const hasDefault = col.column_default ? ` DEFAULT ${col.column_default}` : '';
    console.log(`  - ${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} ${nullable}${hasDefault}`);
  });
  
  // Проверяем наличие client_id
  const hasClientId = columns.some(col => col.column_name === 'client_id');
  
  console.log(`\n${hasClientId ? '✅' : '❌'} Колонка client_id ${hasClientId ? 'НАЙДЕНА' : 'НЕ НАЙДЕНА'}`);
  
  if (!hasClientId) {
    console.log('\n⚠️  ПРОБЛЕМА: Колонка client_id отсутствует в таблице bookings!');
    console.log('   Нужно добавить эту колонку миграцией.');
  }
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

