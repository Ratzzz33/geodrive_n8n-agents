#!/usr/bin/env node
/**
 * Применение миграции напрямую к Neon БД
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function applyMigration() {
  console.log('📥 Читаю файл миграции...');
  const migrationSQL = readFileSync('setup/migrations/007_auto_apply_changes.sql', 'utf-8');
  
  console.log('🔧 Применяю миграцию к БД...\n');
  
  try {
    await sql.unsafe(migrationSQL);
    console.log('✅ Миграция применена успешно!\n');
    
    // Проверяем что функции созданы
    console.log('🧪 Проверяю созданные объекты...');
    
    const tables = await sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename = 'applied_changes'
    `;
    console.log(`  Таблица applied_changes: ${tables.length > 0 ? '✅' : '❌'}`);
    
    const functions = await sql`
      SELECT proname 
      FROM pg_proc 
      WHERE proname IN ('parse_field_change', 'apply_car_change', 'apply_changes_from_history', 'get_branch_by_company_id')
    `;
    console.log(`  Функции: ${functions.length}/4`);
    for (const func of functions) {
      console.log(`    ✅ ${func.proname}`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка при применении миграции:');
    console.error(error.message);
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
    process.exit(1);
  });

