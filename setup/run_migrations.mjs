/**
 * Скрипт для применения миграций БД
 * Запуск: node setup/run_migrations.mjs
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

const migrationsDir = path.join(__dirname, 'migrations');

async function runMigrations() {
  console.log('🚀 Running database migrations...\n');

  try {
    // Получить список файлов миграций
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Сортировка по имени (001_, 002_, ...)

    for (const file of files) {
      console.log(`📄 Applying migration: ${file}`);
      
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf-8');

      try {
        // Выполнить SQL миграцию
        await sql.unsafe(sqlContent);
        console.log(`✅ ${file} applied successfully\n`);
      } catch (error) {
        console.error(`❌ Error applying ${file}:`, error.message);
        throw error;
      }
    }

    console.log('✅ All migrations applied successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigrations();

