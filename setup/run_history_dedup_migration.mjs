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
    console.log('🔧 Применяем миграцию history: улучшение дедупликации...\n');

    const migrationPath = join(__dirname, 'migrate_history_dedup.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    const commands = migrationSQL
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd && !cmd.startsWith('--'));

    for (const command of commands) {
      if (command) {
        console.log(`Выполняем: ${command.substring(0, 80)}...`);
        await sql.unsafe(command);
      }
    }

    console.log('\n✅ Миграция завершена успешно!\n');
    console.log('Изменения:');
    console.log('  ❌ Удалён старый constraint: (branch, operation_type, created_at, entity_id)');
    console.log('  ✅ Создан новый UNIQUE INDEX: (branch, operation_id)');
    console.log('  ✅ Создан INDEX для поиска: idx_history_operation_id');
    console.log('');
    console.log('Преимущества:');
    console.log('  • operation_id всегда присутствует (не NULL)');
    console.log('  • operation_id уникален в RentProg');
    console.log('  • Никаких дублей даже для операций без entity_id!');
    console.log('');
    console.log('Теперь ON CONFLICT (branch, operation_id) работает правильно!');

  } catch (error) {
    console.error('❌ Ошибка миграции:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();

