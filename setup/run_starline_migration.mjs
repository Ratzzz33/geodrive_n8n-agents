/**
 * Запуск миграции для создания таблиц Starline GPS
 */
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  console.log('🚀 Запуск миграции Starline GPS...\n');

  try {
    // Читаем SQL файл миграции
    const migrationPath = path.join(__dirname, '..', 'drizzle', 'migrations', '0013_starline_devices.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Файл миграции найден:', migrationPath);
    console.log('📏 Размер:', Math.round(migrationSQL.length / 1024), 'KB\n');

    // Выполняем миграцию
    console.log('⏳ Выполнение миграции...');
    await sql.unsafe(migrationSQL);
    console.log('✅ Миграция выполнена успешно!\n');

    // Проверяем что таблицы созданы
    console.log('🔍 Проверка созданных таблиц...');
    
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('starline_devices', 'starline_match_history')
      ORDER BY table_name
    `;

    console.log(`✅ Найдено таблиц: ${tables.length}`);
    tables.forEach(t => console.log(`   - ${t.table_name}`));
    console.log('');

    // Проверяем view
    const views = await sql`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' 
        AND table_name = 'starline_devices_with_cars'
    `;

    if (views.length > 0) {
      console.log('✅ View создан: starline_devices_with_cars\n');
    }

    // Проверяем триггеры
    const triggers = await sql`
      SELECT trigger_name 
      FROM information_schema.triggers 
      WHERE event_object_table = 'starline_devices'
    `;

    console.log(`✅ Триггеров создано: ${triggers.length}`);
    triggers.forEach(t => console.log(`   - ${t.trigger_name}`));
    console.log('');

    // Проверяем индексы
    const indexes = await sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename IN ('starline_devices', 'starline_match_history')
      ORDER BY indexname
    `;

    console.log(`✅ Индексов создано: ${indexes.length}`);
    indexes.forEach(i => console.log(`   - ${i.indexname}`));
    console.log('');

    console.log('🎉 Миграция Starline GPS завершена успешно!');
    console.log('');
    console.log('📊 Следующие шаги:');
    console.log('   1. Запустить синхронизацию устройств: POST /starline/sync-devices');
    console.log('   2. Сопоставить с cars: POST /starline/match-devices');
    console.log('   3. Запустить GPS мониторинг: POST /starline/update-gps');
    console.log('   4. Импортировать n8n workflow для автоматического мониторинга');

  } catch (error) {
    console.error('❌ Ошибка при выполнении миграции:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();

