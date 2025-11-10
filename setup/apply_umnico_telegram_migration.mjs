/**
 * Применение миграции для Umnico Telegram интеграции
 * 
 * Запуск: node setup/apply_umnico_telegram_migration.mjs
 */

import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function applyMigration() {
  console.log('🚀 Применение миграции Umnico Telegram интеграции...\n');

  try {
    // Читаем SQL файл миграции
    const migrationPath = path.join(__dirname, '..', 'sql', 'umnico_telegram_integration.sql');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Файл миграции не найден: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('📄 Файл миграции найден:', migrationPath);
    console.log('📏 Размер:', Math.round(migrationSQL.length / 1024), 'KB\n');

    // Выполняем миграцию
    console.log('⏳ Выполнение миграции...');
    await sql.unsafe(migrationSQL);
    console.log('✅ Миграция выполнена успешно!\n');

    // Проверяем что поля добавлены
    console.log('🔍 Проверка добавленных полей...');
    
    const columns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'conversations'
        AND column_name IN ('tg_chat_id', 'tg_topic_id', 'client_name', 'car_info', 'booking_dates', 'session_expires_at', 'assigned_employee_id')
      ORDER BY column_name
    `;

    console.log(`✅ Найдено полей: ${columns.length}/7`);
    columns.forEach(col => {
      console.log(`   ✓ ${col.column_name} (${col.data_type})`);
    });

    // Проверяем индексы
    console.log('\n🔍 Проверка индексов...');
    const indexes = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'conversations'
        AND indexname IN ('idx_conversations_active_sessions', 'idx_conversations_tg_topic', 'idx_conversations_assigned_employee')
      ORDER BY indexname
    `;

    console.log(`✅ Найдено индексов: ${indexes.length}/3`);
    indexes.forEach(idx => {
      console.log(`   ✓ ${idx.indexname}`);
    });

    console.log('\n✅ Миграция применена успешно!');
    console.log('   Все поля и индексы созданы.');

  } catch (error) {
    console.error('\n❌ Ошибка при применении миграции:');
    console.error(error.message);
    
    if (error.code === '42710' || error.message?.includes('already exists')) {
      console.log('\n⚠️  Некоторые объекты уже существуют. Это нормально.');
      console.log('   Миграция использует IF NOT EXISTS, поэтому безопасна для повторного запуска.');
    } else {
      console.error('\n💡 Проверьте:');
      console.error('   - Подключение к БД');
      console.error('   - Права доступа');
      console.error('   - Существование таблицы conversations');
      process.exit(1);
    }
  } finally {
    await sql.end();
  }
}

// Запуск
applyMigration()
  .then(() => {
    console.log('\n✅ Готово!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Критическая ошибка:', error);
    process.exit(1);
  });

