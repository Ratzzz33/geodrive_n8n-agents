/**
 * Миграция: создание таблицы amocrm_deals
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

try {
  console.log('🚀 Запускаю миграцию для amocrm_deals...\n');
  
  // Читаем SQL из файла
  const migrationSQL = readFileSync(join(__dirname, 'create_amocrm_deals_table.sql'), 'utf-8');
  
  // Выполняем миграцию
  await sql.unsafe(migrationSQL);
  
  console.log('✅ Таблица amocrm_deals успешно создана!');
  console.log('✅ Индексы созданы');
  console.log('✅ Миграция завершена\n');
  
  // Проверяем результат
  const result = await sql`
    SELECT 
      table_name, 
      (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'amocrm_deals') as column_count,
      (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'amocrm_deals') as index_count
    FROM information_schema.tables 
    WHERE table_name = 'amocrm_deals'
  `;
  
  if (result.length > 0) {
    console.log('📊 Статистика таблицы:');
    console.log(`   Колонок: ${result[0].column_count}`);
    console.log(`   Индексов: ${result[0].index_count}`);
  }
  
} catch (error) {
  console.error('❌ Ошибка миграции:', error);
  process.exit(1);
} finally {
  await sql.end();
}

