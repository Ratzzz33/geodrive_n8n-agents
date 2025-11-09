/**
 * Запуск миграции для добавления speed и google_maps_link в gps_tracking
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
  console.log('🚀 Запуск миграции GPS Tracking (speed + Google Maps)...\n');

  try {
    // Читаем SQL файл миграции
    const migrationPath = path.join(__dirname, 'migrations', '0014_gps_tracking_speed_and_maps.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Файл миграции найден:', migrationPath);
    console.log('📏 Размер:', Math.round(migrationSQL.length / 1024), 'KB\n');

    // Выполняем миграцию
    console.log('⏳ Выполнение миграции...');
    await sql.unsafe(migrationSQL);
    console.log('✅ Миграция выполнена успешно!\n');

    // Проверяем что таблица создана/обновлена
    console.log('🔍 Проверка таблицы gps_tracking...');
    
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'gps_tracking' 
      ORDER BY ordinal_position
    `;

    console.log(`✅ Найдено колонок: ${columns.length}`);
    
    // Проверяем наличие новых полей
    const hasSpeed = columns.some(c => c.column_name === 'speed');
    const hasGoogleMapsLink = columns.some(c => c.column_name === 'google_maps_link');
    
    if (hasSpeed) {
      console.log('✅ Поле speed добавлено');
    } else {
      console.log('❌ Поле speed НЕ найдено');
    }
    
    if (hasGoogleMapsLink) {
      console.log('✅ Поле google_maps_link добавлено');
    } else {
      console.log('❌ Поле google_maps_link НЕ найдено');
    }
    console.log('');

    // Проверяем индексы
    const indexes = await sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'gps_tracking'
      ORDER BY indexname
    `;

    console.log(`✅ Индексов создано: ${indexes.length}`);
    indexes.forEach(i => console.log(`   - ${i.indexname}`));
    console.log('');

    console.log('🎉 Миграция GPS Tracking завершена успешно!');
    console.log('');
    console.log('📊 Следующие шаги:');
    console.log('   1. Перезапустить Jarvis API: sudo systemctl restart jarvis-api');
    console.log('   2. Запустить обновление GPS: POST /starline/update-gps');
    console.log('   3. Проверить данные в таблице gps_tracking');
    console.log('   4. Скорость теперь берется напрямую от Starline (не вычисляется)');
    console.log('   5. Google Maps ссылки генерируются автоматически');

  } catch (error) {
    console.error('❌ Ошибка при выполнении миграции:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();

