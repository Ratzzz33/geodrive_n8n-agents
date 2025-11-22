#!/usr/bin/env node
/**
 * Применение миграции 0041: Исправление отслеживания изменений в триггерах
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function applyMigration() {
  console.log('📥 Читаю файл миграции 0041...');
  const migrationPath = join(__dirname, 'migrations', '0041_fix_change_tracking_in_triggers.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');
  
  console.log('🔧 Применяю миграцию к БД...\n');
  
  try {
    await sql.unsafe(migrationSQL);
    console.log('✅ Миграция применена успешно!\n');
    
    // Проверяем что функции обновлены
    console.log('🧪 Проверяю обновленные функции...');
    
    const functions = await sql`
      SELECT proname, prosrc
      FROM pg_proc
      WHERE proname IN ('apply_history_changes', 'auto_process_history_trigger', 'process_booking_nested_entities')
      ORDER BY proname
    `;
    
    console.log(`  Найдено функций: ${functions.length}/3\n`);
    
    for (const func of functions) {
      console.log(`  ✅ ${func.proname}`);
      
      // Проверяем наличие updated_by_source в коде функции
      if (func.prosrc.includes('updated_by_source')) {
        console.log(`     ✓ Содержит updated_by_source`);
      } else {
        console.log(`     ⚠️  НЕ содержит updated_by_source`);
      }
      
      if (func.prosrc.includes('updated_by_user')) {
        console.log(`     ✓ Содержит updated_by_user`);
      } else {
        console.log(`     ⚠️  НЕ содержит updated_by_user`);
      }
    }
    
    // Проверяем структуру таблиц
    console.log('\n📊 Проверяю структуру таблиц...');
    
    const carsColumns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'cars'
        AND column_name LIKE 'updated_by%'
      ORDER BY column_name
    `;
    
    console.log(`  Таблица cars: ${carsColumns.length} полей отслеживания`);
    for (const col of carsColumns) {
      console.log(`    ✓ ${col.column_name} (${col.data_type})`);
    }
    
    const bookingsColumns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'bookings'
        AND column_name LIKE 'updated_by%'
      ORDER BY column_name
    `;
    
    console.log(`  Таблица bookings: ${bookingsColumns.length} полей отслеживания`);
    for (const col of bookingsColumns) {
      console.log(`    ✓ ${col.column_name} (${col.data_type})`);
    }
    
    console.log('\n✅ Все проверки пройдены!');
    
  } catch (error) {
    console.error('❌ Ошибка при применении миграции:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await sql.end();
  }
}

applyMigration()
  .then(() => {
    console.log('\n✅ Готово!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Критическая ошибка:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  });

