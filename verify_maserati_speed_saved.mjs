/**
 * Проверка сохранения скорости Maserati в БД после исправления
 */

import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔍 Проверка последних записей скорости Maserati...\n');
  
  // Последние 10 записей из gps_tracking
  const gpsRecords = await sql`
    SELECT 
      starline_alias,
      speed,
      is_moving,
      distance_moved,
      status,
      battery_voltage,
      last_sync,
      TO_CHAR(last_sync AT TIME ZONE 'Asia/Tbilisi', 'DD.MM.YYYY HH24:MI:SS') as time_tbilisi
    FROM gps_tracking
    WHERE starline_alias ILIKE '%maserati%' OR starline_alias ILIKE '%686%'
    ORDER BY last_sync DESC
    LIMIT 10
  `;
  
  console.log('📍 GPS TRACKING (последние 10):');
  console.log('='.repeat(80));
  gpsRecords.forEach((r, i) => {
    console.log(`${i + 1}. ${r.time_tbilisi} (Tbilisi)`);
    console.log(`   Speed: ${r.speed} км/ч ${r.speed > 0 ? '✅' : '❌'}`);
    console.log(`   Moving: ${r.is_moving}`);
    console.log(`   Distance: ${r.distance_moved?.toFixed?.(0) ?? r.distance_moved} м`);
    console.log(`   Status: ${r.status}`);
    console.log(`   Battery: ${r.battery_voltage}V\n`);
  });
  
  // Последние 10 записей из speed_history
  const speedHistory = await sql`
    SELECT 
      speed,
      is_moving,
      status,
      TO_CHAR(timestamp AT TIME ZONE 'Asia/Tbilisi', 'DD.MM.YYYY HH24:MI:SS') as time_tbilisi
    FROM speed_history
    WHERE starline_device_id IN (
      SELECT starline_device_id 
      FROM gps_tracking 
      WHERE starline_alias ILIKE '%maserati%' OR starline_alias ILIKE '%686%'
    )
    ORDER BY timestamp DESC
    LIMIT 10
  `;
  
  console.log('\n📜 SPEED HISTORY (последние 10):');
  console.log('='.repeat(80));
  speedHistory.forEach((r, i) => {
    console.log(`${i + 1}. ${r.time_tbilisi} - Speed: ${r.speed} км/ч ${r.speed > 0 ? '✅' : '❌'} (moving: ${r.is_moving}, status: ${r.status})`);
  });
  
  // Статистика за последний час
  const stats = await sql`
    SELECT 
      COUNT(*) as total_records,
      COUNT(CASE WHEN speed > 0 THEN 1 END) as records_with_speed,
      AVG(speed) as avg_speed,
      MAX(speed) as max_speed,
      MIN(speed) as min_speed
    FROM speed_history
    WHERE starline_device_id IN (
      SELECT starline_device_id 
      FROM gps_tracking 
      WHERE starline_alias ILIKE '%maserati%' OR starline_alias ILIKE '%686%'
    )
    AND timestamp > NOW() - INTERVAL '1 hour'
  `;
  
  console.log('\n📊 СТАТИСТИКА ЗА ПОСЛЕДНИЙ ЧАС:');
  console.log('='.repeat(80));
  if (stats[0].total_records > 0) {
    console.log(`Всего записей: ${stats[0].total_records}`);
    console.log(`С ненулевой скоростью: ${stats[0].records_with_speed} (${((stats[0].records_with_speed / stats[0].total_records) * 100).toFixed(1)}%)`);
    console.log(`Средняя скорость: ${parseFloat(stats[0].avg_speed).toFixed(1)} км/ч`);
    console.log(`Максимальная: ${stats[0].max_speed} км/ч`);
    console.log(`Минимальная: ${stats[0].min_speed} км/ч`);
    
    if (stats[0].records_with_speed > 0) {
      console.log('\n✅ УСПЕХ! Скорость сохраняется в БД!');
    } else {
      console.log('\n⚠️ Все записи с нулевой скоростью');
    }
  } else {
    console.log('Нет записей за последний час');
  }
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
} finally {
  await sql.end();
}

