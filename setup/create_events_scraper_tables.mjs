#!/usr/bin/env node
/**
 * Скрипт создания таблиц для Events Scraper
 * Применяет миграции 005 и 006
 */

import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connection string
const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function main() {
  console.log('🚀 Применение миграций для Events Scraper\n');

  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // 1. Проверка подключения
    console.log('📡 Проверка подключения к БД...');
    const result = await sql`SELECT NOW() as now`;
    console.log(`   ✅ Подключено: ${result[0].now}\n`);

    // 2. Миграция 005: Поля кассы для employees
    console.log('📝 Миграция 005: Добавление полей кассы в employees...');
    const migration005 = fs.readFileSync(
      path.join(__dirname, 'migrations', '005_add_employee_cash.sql'),
      'utf-8'
    );
    await sql.unsafe(migration005);
    console.log('   ✅ Поля кассы добавлены\n');

    // 3. Миграция 006: Таблица event_processing_log
    console.log('📝 Миграция 006: Создание таблицы event_processing_log...');
    const migration006 = fs.readFileSync(
      path.join(__dirname, 'migrations', '006_event_processing_log.sql'),
      'utf-8'
    );
    await sql.unsafe(migration006);
    console.log('   ✅ Таблица event_processing_log создана\n');

    // 4. Проверка созданных объектов
    console.log('🔍 Проверка созданных объектов...\n');

    // Проверка полей employees
    const employeesColumns = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'employees'
        AND column_name IN ('cash_gel', 'cash_usd', 'cash_eur', 'cash_last_updated', 'cash_last_synced', 'task_chat_id')
      ORDER BY column_name
    `;
    console.log('📊 Поля employees:');
    employeesColumns.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (default: ${col.column_default || 'NULL'})`);
    });

    // Проверка таблицы event_processing_log
    const logTable = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'event_processing_log'
      ORDER BY ordinal_position
    `;
    console.log('\n📊 Таблица event_processing_log:');
    logTable.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });

    // Проверка индексов
    const indexes = await sql`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE tablename IN ('employees', 'event_processing_log')
        AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname
    `;
    console.log('\n📊 Созданные индексы:');
    indexes.forEach(idx => {
      console.log(`   - ${idx.tablename}.${idx.indexname}`);
    });

    console.log('\n✅ Все миграции применены успешно!');

    // 5. Тестовая запись (опционально)
    console.log('\n🧪 Создание тестовой записи в event_processing_log...');
    const testEvent = {
      timestamp: new Date().toISOString(),
      branch: 'tbilisi',
      actor: 'Test User',
      action: 'test',
      description: 'Test event from migration script'
    };

    const testHash = `test-${Date.now()}`;
    await sql`
      INSERT INTO event_processing_log (hash, event_data, event_type, branch, actor)
      VALUES (
        ${testHash},
        ${sql.json(testEvent)},
        'test',
        'tbilisi',
        'Test User'
      )
    `;
    console.log('   ✅ Тестовая запись создана');

    // Удалить тестовую запись
    await sql`DELETE FROM event_processing_log WHERE hash = ${testHash}`;
    console.log('   ✅ Тестовая запись удалена\n');

    console.log('🎉 Готово! Events Scraper готов к работе.');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.position) {
      console.error(`   Позиция ошибки: ${error.position}`);
    }
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

