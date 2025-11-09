#!/usr/bin/env node
import postgres from 'postgres';
import { readFileSync } from 'fs';
import 'dotenv/config';

const CONNECTION_STRING = process.env.POSTGRES_CONNECTION_STRING || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('🔧 Запуск миграции для таблицы exchange_rates...\n');
    
    // Читаем SQL файл
    const migrationSQL = readFileSync('setup/migrations/create_exchange_rates_table.sql', 'utf8');
    
    // Выполняем миграцию
    await sql.unsafe(migrationSQL);
    
    console.log('✅ Таблица exchange_rates создана!');
    console.log('\nСтруктура:');
    console.log('  - id (BIGSERIAL)');
    console.log('  - ts (TIMESTAMPTZ) - время парсинга');
    console.log('  - branch (TEXT) - филиал');
    console.log('  - gel_to_rub, gel_to_usd, gel_to_eur (DECIMAL)');
    console.log('  - usd_to_gel, eur_to_gel, rub_to_gel (DECIMAL)');
    console.log('  - raw_data (JSONB) - полные данные');
    console.log('\nИндексы:');
    console.log('  - idx_exchange_rates_branch');
    console.log('  - idx_exchange_rates_ts');
    console.log('  - idx_exchange_rates_branch_ts');
    console.log('\nUnique constraint:');
    console.log('  - (branch, DATE(ts)) - один курс в день на филиал\n');
    
    // Проверяем таблицу
    const result = await sql`
      SELECT 
        table_name,
        (SELECT count(*) FROM exchange_rates) as row_count
      FROM information_schema.tables 
      WHERE table_name = 'exchange_rates'
    `;
    
    if (result.length > 0) {
      console.log(`📊 Записей в таблице: ${result[0].row_count}`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка при выполнении миграции:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();

