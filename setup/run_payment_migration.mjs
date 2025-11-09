import postgres from 'postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function runMigration() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔧 Применяем миграцию payments: добавление payment_id...\n');

    // Читаем SQL файл
    const migrationPath = join(__dirname, 'migrate_payments_add_payment_id.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    // Выполняем каждую команду отдельно
    const commands = migrationSQL
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd && !cmd.startsWith('--'));

    for (const command of commands) {
      if (command) {
        console.log(`Выполняем: ${command.substring(0, 60)}...`);
        await sql.unsafe(command);
      }
    }

    console.log('\n✅ Миграция завершена успешно!\n');
    console.log('Добавлено:');
    console.log('  • Поле payment_id (BIGINT)');
    console.log('  • UNIQUE INDEX payments_branch_payment_id_unique');
    console.log('  • INDEX idx_payments_payment_id');
    console.log('\nТеперь workflow может сохранять данные без дублей!');

  } catch (error) {
    console.error('❌ Ошибка миграции:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();

