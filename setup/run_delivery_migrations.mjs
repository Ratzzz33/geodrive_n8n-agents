/**
 * Применение миграций для системы доставки авто
 * Выполняет все миграции от 0032 до 0039
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

const MIGRATIONS = [
  '0032_create_cities_table.sql',
  '0033_create_city_delivery_pricing.sql',
  '0034_create_car_branch_states.sql',
  '0035_create_one_way_discount_rules.sql',
  '0036_create_future_branch_functions.sql',
  '0037_create_future_branch_triggers.sql',
  '0038_create_car_delivery_options_view.sql',
  '0039_create_out_of_hours_function.sql'
];

async function runMigration(filename) {
  const filePath = join(__dirname, 'migrations', filename);
  console.log(`\n📄 Применение миграции: ${filename}...`);
  
  try {
    const sqlContent = readFileSync(filePath, 'utf8');
    
    // Выполняем весь файл целиком (для функций, триггеров и т.д.)
    await sql.unsafe(sqlContent);
    
    console.log(`   ✅ Миграция ${filename} применена успешно`);
    return true;
  } catch (error) {
    console.error(`   ❌ Ошибка при применении миграции ${filename}:`, error.message);
    if (error.message.includes('already exists')) {
      console.log(`   ⚠️  Объект уже существует, пропускаем...`);
      return true; // Игнорируем ошибки "уже существует"
    }
    return false;
  }
}

async function main() {
  try {
    console.log('🚀 Применение миграций для системы доставки авто\n');
    console.log('='.repeat(60));
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const migration of MIGRATIONS) {
      const success = await runMigration(migration);
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`📊 Итого: ${successCount} успешно, ${errorCount} ошибок`);
    
    if (errorCount === 0) {
      console.log('✅ Все миграции применены успешно!');
    } else {
      console.log('⚠️  Некоторые миграции завершились с ошибками');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Критическая ошибка:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

