#!/usr/bin/env node
/**
 * Применение оставшихся миграций нормализации БД
 * Использование: node setup/apply_remaining_migrations.mjs
 */
import 'dotenv/config';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const fallbackUrl =
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const connectionString =
  (process.env.DATABASE_URL_B64
    ? Buffer.from(process.env.DATABASE_URL_B64, 'base64').toString('utf8')
    : process.env.DATABASE_URL) || fallbackUrl;

// Кодируем для передачи в дочерние процессы
const bytes = Buffer.from(connectionString, 'utf8');
const encodedUrl = bytes.toString('base64');

const migrations = [
  '014_seed_external_refs_from_tasks_telegram.sql',
  '016_seed_external_refs_from_payments_rp.sql',
  '015_remove_tasks_telegram_columns.sql',
];

console.log('📦 Применение оставшихся миграций нормализации БД\n');

for (const migration of migrations) {
  const migrationPath = path.join(projectRoot, 'db', 'migrations', migration);
  console.log(`📄 ${migration}`);
  
  try {
    execSync(
      `node setup/apply_sql_file.mjs "${migrationPath}"`,
      {
        cwd: projectRoot,
        env: { ...process.env, DATABASE_URL_B64: encodedUrl },
        stdio: 'inherit',
      }
    );
    console.log(`   ✅ Применено\n`);
  } catch (error) {
    console.error(`   ❌ Ошибка: ${error.message}\n`);
    process.exit(1);
  }
}

console.log('✅ Все миграции применены');

