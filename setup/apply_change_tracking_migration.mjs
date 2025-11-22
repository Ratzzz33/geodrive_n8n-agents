#!/usr/bin/env node
/**
 * Применение миграции для отслеживания источника изменений
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function applyMigration() {
  try {
    console.log('🔧 Применение миграции для отслеживания источника изменений...\n');

    const migrationPath = join(__dirname, 'migrations', '021_add_change_tracking_fields.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('1️⃣ Выполнение миграции...');
    await sql.unsafe(migrationSQL);
    console.log('   ✅ Миграция применена успешно\n');

    // Проверяем, что поля добавлены
    console.log('2️⃣ Проверка добавленных полей...');
    
    const carsColumns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'cars' 
        AND column_name LIKE 'updated_by%'
      ORDER BY column_name
    `;

    console.log(`   ✅ В таблице cars добавлено ${carsColumns.length} полей:`);
    carsColumns.forEach(col => {
      console.log(`      - ${col.column_name} (${col.data_type})`);
    });

    const carPricesColumns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'car_prices' 
        AND column_name LIKE 'updated_by%'
      ORDER BY column_name
    `;

    console.log(`\n   ✅ В таблице car_prices добавлено ${carPricesColumns.length} полей:`);
    carPricesColumns.forEach(col => {
      console.log(`      - ${col.column_name} (${col.data_type})`);
    });

    // Проверяем индексы
    console.log('\n3️⃣ Проверка индексов...');
    const indexes = await sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename IN ('cars', 'car_prices')
        AND indexname LIKE '%updated_by%'
    `;

    console.log(`   ✅ Создано ${indexes.length} индексов:`);
    indexes.forEach(idx => {
      console.log(`      - ${idx.indexname}`);
    });

    // Проверяем функцию
    console.log('\n4️⃣ Проверка helper функции...');
    const functions = await sql`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_name = 'set_update_source'
        AND routine_schema = 'public'
    `;

    if (functions.length > 0) {
      console.log('   ✅ Функция set_update_source создана');
    } else {
      console.log('   ⚠️  Функция set_update_source не найдена');
    }

    console.log('\n✅ Миграция завершена успешно!');
    console.log('\n📝 Следующие шаги:');
    console.log('   1. Обновить src/db/schema.ts - добавить поля в Drizzle schema');
    console.log('   2. Обновить функции upsert - передавать информацию об источнике');
    console.log('   3. Обновить workflow - передавать execution_id и workflow name');
    console.log('   4. Обновить триггеры - сохранять источник при автоматических изменениях');

  } catch (error) {
    console.error('❌ Ошибка при применении миграции:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

applyMigration();

