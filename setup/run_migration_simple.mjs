import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('1. Удаление дубликатов...');
  await sql`DELETE FROM gps_tracking gt1 WHERE gt1.id NOT IN (SELECT DISTINCT ON (starline_device_id) id FROM gps_tracking WHERE starline_device_id IS NOT NULL ORDER BY starline_device_id, last_sync DESC NULLS LAST, id DESC)`;
  
  console.log('2. Удаление UNIQUE constraint на car_id...');
  await sql`DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gps_tracking_car_id_key') THEN ALTER TABLE gps_tracking DROP CONSTRAINT gps_tracking_car_id_key; END IF; END $$`;
  
  console.log('3. Создание уникального индекса на starline_device_id...');
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS gps_tracking_starline_device_id_unique ON gps_tracking(starline_device_id) WHERE starline_device_id IS NOT NULL`;
  
  console.log('4. Исправление неправильных записей...');
  await sql`UPDATE gps_tracking gt SET car_id = sd.car_id FROM starline_devices sd WHERE gt.starline_device_id = sd.device_id AND sd.matched = TRUE AND sd.active = TRUE AND gt.car_id != sd.car_id`;
  
  console.log('✅ Миграция выполнена успешно');
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

