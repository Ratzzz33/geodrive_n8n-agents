#!/usr/bin/env node
/**
 * Применение миграции с триггерами для автоматической обработки событий
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

async function applyMigration() {
  console.log('\n📥 Применение миграции: Автоматическая обработка событий через триггеры\n');
  console.log('='.repeat(80));

  try {
    // Читаем SQL файл
    const sqlFile = join(__dirname, 'migrations', '0024_auto_process_events_trigger.sql');
    const sqlContent = readFileSync(sqlFile, 'utf8');

    // Выполняем миграцию
    console.log('Выполнение SQL...\n');
    await sql.unsafe(sqlContent);

    console.log('✅ Миграция применена успешно!\n');
    console.log('📋 Создано:');
    console.log('   - Функция get_branch_from_company_id()');
    console.log('   - Функция extract_ext_id_from_event()');
    console.log('   - Функция auto_process_event_trigger()');
    console.log('   - Триггер auto_process_event_on_insert');
    console.log('   - Функция process_all_unprocessed_events()\n');
    
    console.log('🔔 Триггер будет автоматически отправлять pg_notify при вставке новых событий\n');
    console.log('💡 Для обработки уведомлений запустите:');
    console.log('   node setup/create_event_listener_service.mjs\n');
    console.log('💡 Или обработайте все существующие события:');
    console.log('   SELECT * FROM process_all_unprocessed_events();\n');

  } catch (error) {
    console.error('\n❌ Ошибка при применении миграции:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

applyMigration().catch(console.error);

