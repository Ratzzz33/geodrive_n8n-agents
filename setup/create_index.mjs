import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('Создание уникального индекса на starline_device_id...');
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS gps_tracking_starline_device_id_unique ON gps_tracking(starline_device_id) WHERE starline_device_id IS NOT NULL`;
  console.log('✅ Индекс создан');
} catch (error) {
  console.error('❌ Ошибка:', error.message);
} finally {
  await sql.end();
}

