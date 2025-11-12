/**
 * Применение миграции для системы логирования API endpoints
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function applyMigration() {
  const sql = postgres(DATABASE_URL, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('📦 Применение миграции для системы логирования API...\n');

    const migrationPath = join(__dirname, '../db/migrations/006_create_api_logging_tables.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    await sql.unsafe(migrationSQL);

    console.log('✅ Миграция применена успешно!');
    console.log('\n📊 Созданы таблицы:');
    console.log('   - api_endpoints (метаданные endpoints)');
    console.log('   - api_request_logs (логи запросов)');
    console.log('\n🚀 Система логирования готова к использованию!');

  } catch (error) {
    console.error('❌ Ошибка при применении миграции:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

applyMigration();

