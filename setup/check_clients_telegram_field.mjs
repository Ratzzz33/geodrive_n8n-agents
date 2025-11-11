#!/usr/bin/env node
/**
 * Проверка наличия поля telegram_username в таблице clients
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkClientsStructure() {
  console.log('🔍 Проверка структуры таблицы clients...\n');

  try {
    // 1. Проверка существования таблицы
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'clients'
      )
    `;
    
    if (!tableExists[0].exists) {
      console.log('❌ Таблица clients не существует!');
      console.log('   Запустите: node setup/ensure_umnico_tables.mjs');
      process.exit(1);
    }
    
    console.log('✅ Таблица clients существует\n');

    // 2. Получить все колонки
    console.log('📊 Структура таблицы clients:');
    const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'clients'
      ORDER BY ordinal_position
    `;
    
    console.log('');
    for (const col of columns) {
      const nullable = col.is_nullable === 'YES' ? 'nullable' : 'not null';
      const defaultVal = col.column_default ? ` default ${col.column_default}` : '';
      console.log(`   ${col.column_name}: ${col.data_type} (${nullable})${defaultVal}`);
    }

    // 3. Проверка критичных полей
    console.log('\n🔍 Проверка необходимых полей:');
    const requiredFields = {
      'id': columns.some(c => c.column_name === 'id'),
      'phone': columns.some(c => c.column_name === 'phone'),
      'telegram_username': columns.some(c => c.column_name === 'telegram_username'),
      'email': columns.some(c => c.column_name === 'email'),
      'updated_at': columns.some(c => c.column_name === 'updated_at')
    };
    
    for (const [field, exists] of Object.entries(requiredFields)) {
      console.log(`   ${field}: ${exists ? '✅' : '❌'}`);
    }

    // 4. Проверка индексов
    console.log('\n📇 Проверка индексов:');
    const indexes = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'clients'
      ORDER BY indexname
    `;
    
    if (indexes.length === 0) {
      console.log('   ⚠️  Индексы не найдены');
    } else {
      for (const idx of indexes) {
        console.log(`   ✅ ${idx.indexname}`);
      }
    }

    // 5. Статистика
    console.log('\n📊 Статистика:');
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(phone) as with_phone,
        COUNT(telegram_username) as with_telegram,
        COUNT(*) FILTER (WHERE phone IS NOT NULL AND telegram_username IS NULL) as only_phone,
        COUNT(*) FILTER (WHERE phone IS NULL AND telegram_username IS NOT NULL) as only_telegram,
        COUNT(*) FILTER (WHERE phone IS NOT NULL AND telegram_username IS NOT NULL) as both
      FROM clients
    `;
    
    const s = stats[0];
    console.log(`   Всего клиентов: ${s.total}`);
    console.log(`   С телефоном: ${s.with_phone} (${Math.round(s.with_phone / s.total * 100)}%)`);
    console.log(`   С Telegram: ${s.with_telegram} (${Math.round(s.with_telegram / s.total * 100)}%)`);
    console.log(`   Только телефон: ${s.only_phone}`);
    console.log(`   Только Telegram: ${s.only_telegram}`);
    console.log(`   Оба: ${s.both}`);

    // 6. Итоговое заключение
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (requiredFields.telegram_username) {
      console.log('✅ ГОТОВО: Поле telegram_username существует');
      console.log('   Можно запускать синхронизацию с новой логикой\n');
    } else {
      console.log('⚠️  ТРЕБУЕТСЯ МИГРАЦИЯ: Поле telegram_username не найдено');
      console.log('   Запустите: psql $DATABASE_URL -f sql/conversations_schema.sql');
      console.log('   Или: node setup/apply_conversation_migration.mjs\n');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkClientsStructure();

