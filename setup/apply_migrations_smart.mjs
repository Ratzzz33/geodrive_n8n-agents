#!/usr/bin/env node
/**
 * Умное применение миграций с проверкой структуры БД
 */
import 'dotenv/config';
import postgres from 'postgres';
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

const sql = postgres(connectionString, {
  max: 1,
  ssl: { rejectUnauthorized: false },
});

const checkColumnExists = async (table, column) => {
  const result = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = ${table} 
      AND column_name = ${column}
  `;
  return result.length > 0;
};

const applyMigration = (migrationPath) => {
  console.log(`📄 ${path.basename(migrationPath)}`);
  try {
    execSync(
      `node setup/apply_sql_file.mjs "${migrationPath}"`,
      {
        cwd: projectRoot,
        env: { ...process.env, DATABASE_URL_B64: process.env.DATABASE_URL_B64 },
        stdio: 'inherit',
      }
    );
    console.log(`   ✅ Применено\n`);
    return true;
  } catch (error) {
    console.error(`   ❌ Ошибка: ${error.message}\n`);
    return false;
  }
};

const run = async () => {
  console.log('🔍 Проверка структуры БД перед применением миграций...\n');

  // Проверка tasks
  const tasksHasTgChat = await checkColumnExists('tasks', 'tg_chat_id');
  const tasksHasTgTopic = await checkColumnExists('tasks', 'tg_topic_id');
  
  // Проверка payments
  const paymentsHasCarId = await checkColumnExists('payments', 'car_id');
  const paymentsHasClientId = await checkColumnExists('payments', 'client_id');
  const paymentsHasUserId = await checkColumnExists('payments', 'user_id');

  console.log('📊 Текущее состояние:');
  console.log(`   tasks.tg_chat_id: ${tasksHasTgChat ? '✅ есть' : '❌ нет'}`);
  console.log(`   tasks.tg_topic_id: ${tasksHasTgTopic ? '✅ есть' : '❌ нет'}`);
  console.log(`   payments.car_id: ${paymentsHasCarId ? '✅ есть' : '❌ нет'}`);
  console.log(`   payments.client_id: ${paymentsHasClientId ? '✅ есть' : '❌ нет'}`);
  console.log(`   payments.user_id: ${paymentsHasUserId ? '✅ есть' : '❌ нет'}`);
  console.log('');

  const migrations = [];

  // Миграция 014 - только если есть колонки в tasks
  if (tasksHasTgChat || tasksHasTgTopic) {
    migrations.push({
      path: path.join(projectRoot, 'db', 'migrations', '014_seed_external_refs_from_tasks_telegram.sql'),
      name: '014_seed_external_refs_from_tasks_telegram.sql',
      required: true,
    });
  } else {
    console.log('⏭️  Миграция 014 пропущена (колонки уже удалены)\n');
  }

  // Миграция 016 - всегда применяем (rp_* поля должны быть)
  migrations.push({
    path: path.join(projectRoot, 'db', 'migrations', '016_seed_external_refs_from_payments_rp.sql'),
    name: '016_seed_external_refs_from_payments_rp.sql',
    required: true,
  });

  // Миграция 015 - только если есть колонки в tasks
  if (tasksHasTgChat || tasksHasTgTopic) {
    migrations.push({
      path: path.join(projectRoot, 'db', 'migrations', '015_remove_tasks_telegram_columns.sql'),
      name: '015_remove_tasks_telegram_columns.sql',
      required: true,
    });
  } else {
    console.log('⏭️  Миграция 015 пропущена (колонки уже удалены)\n');
  }

  console.log(`📦 Применение ${migrations.length} миграций...\n`);

  let allSuccess = true;
  for (const migration of migrations) {
    if (!applyMigration(migration.path)) {
      if (migration.required) {
        allSuccess = false;
        break;
      }
    }
  }

  if (allSuccess) {
    console.log('✅ Все миграции применены успешно');
  } else {
    console.error('❌ Некоторые миграции не применены');
    process.exitCode = 1;
  }
};

run()
  .catch((error) => {
    console.error('❌ Сбой выполнения:', error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());

