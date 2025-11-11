#!/usr/bin/env node

/**
 * =============================================
 * СКРИПТ ПРИМЕНЕНИЯ МИГРАЦИЙ ДЛЯ НОРМАЛИЗАЦИИ ДАННЫХ БРОНЕЙ
 * =============================================
 * 
 * Применяет все миграции в правильном порядке:
 * 1. 001_add_bookings_fields.sql - добавление полей
 * 2. 002_normalize_bookings_dates.sql - нормализация дат
 * 3. 003_normalize_bookings_status.sql - нормализация статусов
 * 4. 004_create_bookings_sync_trigger.sql - создание триггера
 * 5. 005_backfill_bookings_data.sql - финальный бэкфилл
 * 
 * ИСПОЛЬЗОВАНИЕ:
 *   node db/migrations/apply-migrations.mjs [--dry-run] [--single=001]
 * 
 * ПАРАМЕТРЫ:
 *   --dry-run     - режим проверки (без изменений в БД)
 *   --single=001  - применить только одну миграцию (например 001)
 *   --from=002    - начать с конкретной миграции
 *   --to=004      - закончить на конкретной миграции
 * 
 * ПРИМЕРЫ:
 *   node db/migrations/apply-migrations.mjs
 *   node db/migrations/apply-migrations.mjs --dry-run
 *   node db/migrations/apply-migrations.mjs --single=001
 *   node db/migrations/apply-migrations.mjs --from=002 --to=004
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================
// КОНФИГУРАЦИЯ
// =============================================

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const MIGRATIONS_DIR = __dirname;

const MIGRATIONS = [
  '001_add_bookings_fields.sql',
  '002_normalize_bookings_dates.sql',
  '003_normalize_bookings_status.sql',
  '004_create_bookings_sync_trigger.sql',
  '005_backfill_bookings_data.sql'
];

// =============================================
// ПАРСИНГ АРГУМЕНТОВ
// =============================================

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const singleMigration = args.find(arg => arg.startsWith('--single='))?.split('=')[1];
const fromMigration = args.find(arg => arg.startsWith('--from='))?.split('=')[1];
const toMigration = args.find(arg => arg.startsWith('--to='))?.split('=')[1];

// =============================================
// ФУНКЦИИ
// =============================================

/**
 * Получить список миграций для применения
 */
function getMigrationsToApply() {
  let migrations = [...MIGRATIONS];
  
  // Если указана одна миграция
  if (singleMigration) {
    const migrationFile = migrations.find(m => m.startsWith(singleMigration));
    if (!migrationFile) {
      console.error(`❌ Миграция ${singleMigration} не найдена`);
      process.exit(1);
    }
    return [migrationFile];
  }
  
  // Если указан диапазон
  if (fromMigration || toMigration) {
    const fromIndex = fromMigration 
      ? migrations.findIndex(m => m.startsWith(fromMigration))
      : 0;
    const toIndex = toMigration 
      ? migrations.findIndex(m => m.startsWith(toMigration))
      : migrations.length - 1;
    
    if (fromIndex === -1) {
      console.error(`❌ Миграция ${fromMigration} не найдена`);
      process.exit(1);
    }
    if (toIndex === -1) {
      console.error(`❌ Миграция ${toMigration} не найдена`);
      process.exit(1);
    }
    
    migrations = migrations.slice(fromIndex, toIndex + 1);
  }
  
  return migrations;
}

/**
 * Прочитать SQL файл миграции
 */
function readMigrationFile(filename) {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  
  if (!fs.existsSync(filepath)) {
    throw new Error(`Файл миграции не найден: ${filepath}`);
  }
  
  return fs.readFileSync(filepath, 'utf8');
}

/**
 * Применить миграцию
 */
async function applyMigration(sql, filename, migrationSQL) {
  const startTime = Date.now();
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📄 Применение миграции: ${filename}`);
  console.log(`${'='.repeat(60)}`);
  
  if (isDryRun) {
    console.log('\n🔍 РЕЖИМ ПРОВЕРКИ (dry-run) - изменения не будут применены');
    console.log('\nSQL для выполнения:');
    console.log('─'.repeat(60));
    console.log(migrationSQL.substring(0, 500) + (migrationSQL.length > 500 ? '...' : ''));
    console.log('─'.repeat(60));
    console.log(`\nДлина SQL: ${migrationSQL.length} символов`);
  } else {
    try {
      // Выполняем миграцию
      await sql.unsafe(migrationSQL);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✅ Миграция ${filename} применена успешно (${duration}s)`);
    } catch (error) {
      console.error(`\n❌ Ошибка при применении миграции ${filename}:`);
      console.error(error.message);
      throw error;
    }
  }
}

/**
 * Получить статистику до миграций
 */
async function getStatsBefore(sql) {
  console.log('\n📊 Статистика ПЕРЕД миграциями:');
  console.log('─'.repeat(60));
  
  try {
    // Всего броней
    const [{ count: totalBookings }] = await sql`
      SELECT COUNT(*) as count FROM bookings
    `;
    console.log(`   Всего броней: ${totalBookings}`);
    
    // Проверяем существование полей
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bookings'
      ORDER BY column_name
    `;
    
    const columnNames = columns.map(c => c.column_name);
    const hasStartDate = columnNames.includes('start_date');
    const hasState = columnNames.includes('state');
    
    if (hasStartDate) {
      const [{ count: nullStartDates }] = await sql`
        SELECT COUNT(*) as count 
        FROM bookings 
        WHERE start_date IS NULL OR end_date IS NULL
      `;
      console.log(`   Брони с NULL в start_date/end_date: ${nullStartDates}`);
    } else {
      console.log('   ⚠️  Поля start_date/end_date не существуют (будут созданы)');
    }
    
    const [{ count: nullStartAt }] = await sql`
      SELECT COUNT(*) as count 
      FROM bookings 
      WHERE start_at IS NULL OR end_at IS NULL
    `;
    console.log(`   Брони с NULL в start_at/end_at: ${nullStartAt}`);
    
    if (hasState) {
      const [{ count: nullState }] = await sql`
        SELECT COUNT(*) as count 
        FROM bookings 
        WHERE state IS NULL
      `;
      console.log(`   Брони с NULL в state: ${nullState}`);
    } else {
      console.log('   ⚠️  Поле state не существует (будет создано)');
    }
    
    const [{ count: nullStatus }] = await sql`
      SELECT COUNT(*) as count 
      FROM bookings 
      WHERE status IS NULL
    `;
    console.log(`   Брони с NULL в status: ${nullStatus}`);
    
  } catch (error) {
    console.log('   ⚠️  Ошибка получения статистики (возможно таблица не существует)');
    console.log(`   ${error.message}`);
  }
  
  console.log('─'.repeat(60));
}

/**
 * Получить статистику после миграций
 */
async function getStatsAfter(sql) {
  console.log('\n📊 Статистика ПОСЛЕ миграций:');
  console.log('─'.repeat(60));
  
  try {
    const [{ count: totalBookings }] = await sql`
      SELECT COUNT(*) as count FROM bookings
    `;
    console.log(`   Всего броней: ${totalBookings}`);
    
    const [{ count: nullStartDates }] = await sql`
      SELECT COUNT(*) as count 
      FROM bookings 
      WHERE start_date IS NULL OR end_date IS NULL
    `;
    console.log(`   Брони с NULL в start_date/end_date: ${nullStartDates}`);
    
    const [{ count: nullStartAt }] = await sql`
      SELECT COUNT(*) as count 
      FROM bookings 
      WHERE start_at IS NULL OR end_at IS NULL
    `;
    console.log(`   Брони с NULL в start_at/end_at: ${nullStartAt}`);
    
    const [{ count: nullState }] = await sql`
      SELECT COUNT(*) as count 
      FROM bookings 
      WHERE state IS NULL
    `;
    console.log(`   Брони с NULL в state: ${nullState}`);
    
    const [{ count: nullStatus }] = await sql`
      SELECT COUNT(*) as count 
      FROM bookings 
      WHERE status IS NULL
    `;
    console.log(`   Брони с NULL в status: ${nullStatus}`);
    
    const [{ count: activeBookings }] = await sql`
      SELECT COUNT(*) as count 
      FROM bookings 
      WHERE state IN ('Активная', 'Новая', 'Подтверждена')
         OR status IN ('active', 'confirmed', 'in_rent')
    `;
    console.log(`   Активные брони: ${activeBookings}`);
    
    // Проверка синхронизации дат
    const [{ count: unsyncedDates }] = await sql`
      SELECT COUNT(*) as count 
      FROM bookings 
      WHERE start_date IS NOT NULL 
        AND start_at IS NOT NULL
        AND start_date::timestamptz != start_at
    `;
    console.log(`   Несинхронизированные даты: ${unsyncedDates}`);
    
  } catch (error) {
    console.log('   ⚠️  Ошибка получения статистики');
    console.log(`   ${error.message}`);
  }
  
  console.log('─'.repeat(60));
}

// =============================================
// ОСНОВНАЯ ФУНКЦИЯ
// =============================================

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('🚀 ПРИМЕНЕНИЕ МИГРАЦИЙ ДЛЯ НОРМАЛИЗАЦИИ ДАННЫХ БРОНЕЙ');
  console.log('═'.repeat(60));
  
  if (isDryRun) {
    console.log('\n⚠️  РЕЖИМ ПРОВЕРКИ (DRY-RUN) - изменения не будут применены');
  }
  
  const migrationsToApply = getMigrationsToApply();
  console.log(`\n📋 Будет применено миграций: ${migrationsToApply.length}`);
  migrationsToApply.forEach((m, i) => {
    console.log(`   ${i + 1}. ${m}`);
  });
  
  // Подключение к БД
  console.log('\n🔌 Подключение к базе данных...');
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    // Проверка подключения
    await sql`SELECT 1`;
    console.log('✅ Подключение установлено');
    
    // Статистика ДО миграций
    if (!isDryRun) {
      await getStatsBefore(sql);
    }
    
    // Применяем миграции
    for (const migrationFile of migrationsToApply) {
      const migrationSQL = readMigrationFile(migrationFile);
      await applyMigration(sql, migrationFile, migrationSQL);
    }
    
    // Статистика ПОСЛЕ миграций
    if (!isDryRun) {
      await getStatsAfter(sql);
    }
    
    // Финальный отчет
    console.log('\n' + '═'.repeat(60));
    if (isDryRun) {
      console.log('✅ ПРОВЕРКА ЗАВЕРШЕНА (dry-run)');
      console.log('💡 Запустите без --dry-run для применения изменений');
    } else {
      console.log('✅ ВСЕ МИГРАЦИИ ПРИМЕНЕНЫ УСПЕШНО!');
      console.log('');
      console.log('🎉 Данные броней нормализованы!');
      console.log('📝 Триггер создан - новые данные будут синхронизироваться автоматически');
      console.log('🔍 Поиск автомобилей теперь работает корректно');
    }
    console.log('═'.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ ОШИБКА ПРИ ПРИМЕНЕНИИ МИГРАЦИЙ:');
    console.error(error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// =============================================
// ЗАПУСК
// =============================================

main().catch(console.error);

