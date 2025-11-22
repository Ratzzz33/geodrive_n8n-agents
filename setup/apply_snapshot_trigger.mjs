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

async function applyMigration() {
  try {
    console.log('🚀 Применение миграции 019_sync_cars_from_snapshot_trigger.sql...\n');

    // Читаем файл миграции
    const migrationPath = join(__dirname, 'migrations', '019_sync_cars_from_snapshot_trigger.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // Применяем миграцию
    await sql.unsafe(migrationSQL);

    console.log('✅ Миграция применена успешно!\n');

    // Проверяем, что триггер создан
    console.log('🔍 Проверка триггера...\n');
    const trigger = await sql`
      SELECT 
        tgname as trigger_name,
        tgenabled as enabled,
        tgrelid::regclass as table_name
      FROM pg_trigger
      WHERE tgname = 'trg_sync_cars_from_snapshot'
    `;

    if (trigger.length > 0) {
      console.log('✅ Триггер создан:');
      console.log(`   - Имя: ${trigger[0].trigger_name}`);
      console.log(`   - Таблица: ${trigger[0].table_name}`);
      console.log(`   - Статус: ${trigger[0].enabled === 'O' ? 'ВКЛЮЧЕН ✅' : 'ОТКЛЮЧЕН ❌'}\n`);
    } else {
      console.log('❌ Триггер не найден!\n');
    }

    // Проверяем функцию
    const function_check = await sql`
      SELECT proname as function_name
      FROM pg_proc
      WHERE proname = 'sync_cars_from_snapshot'
    `;

    if (function_check.length > 0) {
      console.log('✅ Функция создана:');
      console.log(`   - Имя: ${function_check[0].function_name}\n`);
    } else {
      console.log('❌ Функция не найдена!\n');
    }

    // Убеждаемся, что триггер включен
    console.log('🔧 Включаем триггер (если он отключен)...\n');
    await sql`
      ALTER TABLE rentprog_car_states_snapshot
      ENABLE TRIGGER trg_sync_cars_from_snapshot
    `;
    console.log('✅ Триггер включен!\n');

    console.log('🎉 Миграция применена и триггер активен!\n');

  } catch (error) {
    console.error('❌ Ошибка при применении миграции:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

applyMigration();

