#!/usr/bin/env node
/**
 * Применение миграции: добавление поля telegram_username в таблицу clients
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function applyMigration() {
  console.log('🚀 Применение миграции: telegram_username\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // 1. Добавить поле telegram_username
    console.log('1️⃣ Добавление поля telegram_username...');
    await sql`
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS telegram_username TEXT
    `;
    console.log('   ✅ Поле telegram_username добавлено\n');

    // 2. Создать индекс
    console.log('2️⃣ Создание индекса...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_clients_telegram ON clients(telegram_username)
    `;
    console.log('   ✅ Индекс idx_clients_telegram создан\n');

    // 3. Проверить результат
    console.log('3️⃣ Проверка результата...');
    const columns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'clients'
      AND column_name = 'telegram_username'
    `;
    
    if (columns.length > 0) {
      console.log(`   ✅ Поле telegram_username: ${columns[0].data_type}\n`);
    } else {
      console.log('   ❌ Поле не найдено!\n');
      process.exit(1);
    }

    // 4. Проверить индекс
    const indexes = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'clients'
      AND indexname = 'idx_clients_telegram'
    `;
    
    if (indexes.length > 0) {
      console.log(`   ✅ Индекс ${indexes[0].indexname} создан\n`);
    }

    // 5. Итоговая статистика
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ МИГРАЦИЯ УСПЕШНО ПРИМЕНЕНА\n');
    console.log('Следующие шаги:');
    console.log('  1. npm run build');
    console.log('  2. python deploy_fixes_now.py');
    console.log('  3. node setup/test_umnico_parsing_v2.mjs\n');

  } catch (error) {
    console.error('\n❌ ОШИБКА:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

applyMigration();

