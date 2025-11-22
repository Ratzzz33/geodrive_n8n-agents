#!/usr/bin/env node
/**
 * Выполнение миграции для Starline API таблиц
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Connection string из документации
const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function runMigration() {
  console.log('🔄 Выполняю миграцию для Starline API...\n');

  const sql = postgres(DATABASE_URL, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Читаем файл миграции
    const migrationPath = join(__dirname, 'migrations', '0023_starline_api_tables.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('📄 Читаю файл миграции...');
    console.log(`   Путь: ${migrationPath}\n`);

    // Выполняем миграцию
    console.log('⚙️  Выполняю SQL команды...');
    await sql.unsafe(migrationSQL);

    console.log('✅ Миграция успешно выполнена!\n');

    // Проверяем созданные таблицы
    console.log('🔍 Проверяю созданные таблицы...');
    
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('starline_api_tokens', 'starline_events', 'starline_routes')
      ORDER BY table_name
    `;

    console.log(`   Найдено таблиц: ${tables.length}`);
    tables.forEach(t => console.log(`   ✅ ${t.table_name}`));

    // Проверяем новые поля в gps_tracking
    console.log('\n🔍 Проверяю новые поля в gps_tracking...');
    const gpsColumns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'gps_tracking' 
        AND column_name IN ('course', 'alarm_state', 'geofence_status')
      ORDER BY column_name
    `;
    
    console.log(`   Найдено полей: ${gpsColumns.length}`);
    gpsColumns.forEach(c => console.log(`   ✅ ${c.column_name}`));

    // Проверяем новые поля в starline_devices
    console.log('\n🔍 Проверяю новые поля в starline_devices...');
    const deviceColumns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'starline_devices' 
        AND column_name IN ('last_api_sync', 'api_token_expires_at')
      ORDER BY column_name
    `;
    
    console.log(`   Найдено полей: ${deviceColumns.length}`);
    deviceColumns.forEach(c => console.log(`   ✅ ${c.column_name}`));

    console.log('\n✨ Все проверки пройдены успешно!');

  } catch (error) {
    console.error('❌ Ошибка при выполнении миграции:');
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

runMigration();
