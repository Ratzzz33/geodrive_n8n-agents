/**
 * Скрипт для выполнения миграции 001_add_cars_data_field.sql
 * Добавляет поле data (JSONB) в таблицу cars
 * 
 * Использование:
 *   node setup/migrations/run_001_migration.mjs
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Connection string для Neon PostgreSQL
const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function runMigration() {
  console.log('🚀 Запуск миграции: 001_add_cars_data_field');
  console.log('📁 Подключение к Neon PostgreSQL...');

  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Читаем файл миграции
    const migrationPath = join(__dirname, '001_add_cars_data_field.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📝 Выполнение миграции...');
    
    // Выполняем миграцию
    await sql.unsafe(migrationSQL);

    console.log('✅ Миграция успешно выполнена!');
    
    // Проверяем результат
    const result = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'cars' AND column_name = 'data'
    `;

    if (result.length > 0) {
      console.log('✓ Поле data добавлено:');
      console.log(`  - Тип: ${result[0].data_type}`);
      console.log(`  - По умолчанию: ${result[0].column_default}`);
    } else {
      console.error('✗ Поле data не найдено после миграции');
      process.exit(1);
    }

    // Проверяем индекс
    const indexResult = await sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'cars' AND indexname = 'idx_cars_data_gin'
    `;

    if (indexResult.length > 0) {
      console.log('✓ GIN индекс создан: idx_cars_data_gin');
    }

  } catch (error) {
    console.error('❌ Ошибка при выполнении миграции:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();

