import postgres from 'postgres';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(DATABASE_URL, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  console.log('🚀 Запускаю миграцию для amocrm_webhook_events...');
  try {
    const schemaPath = path.join(process.cwd(), 'setup', 'create_amocrm_webhook_events_table.sql');
    const schemaSql = await fs.readFile(schemaPath, 'utf8');

    const result = await sql.unsafe(schemaSql);

    console.log('✅ Таблица amocrm_webhook_events успешно создана!');
    console.log('✅ Индексы созданы');
    console.log('✅ Миграция завершена');

    // Дополнительная проверка для статистики
    const stats = await sql`
      SELECT
        COUNT(*) AS columns_count
      FROM information_schema.columns
      WHERE table_name = 'amocrm_webhook_events';
    `;
    const indexes = await sql`
      SELECT
        COUNT(*) AS indexes_count
      FROM pg_indexes
      WHERE tablename = 'amocrm_webhook_events';
    `;

    console.log(`\n📊 Статистика таблицы:`);
    console.log(`   Колонок: ${stats[0].columns_count}`);
    console.log(`   Индексов: ${indexes[0].indexes_count}`);

  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();

