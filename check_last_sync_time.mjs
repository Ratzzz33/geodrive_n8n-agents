import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔍 Проверка времени последней синхронизации для OB700OB\n');

  // Проверяем GPS данные
  const gps = await sql`
    SELECT 
      car_id,
      starline_device_id,
      starline_alias,
      last_sync,
      current_timestamp,
      updated_at
    FROM gps_tracking
    WHERE starline_device_id = 864326066742275
    ORDER BY last_sync DESC
    LIMIT 1
  `;

  console.log('📍 GPS данные:');
  if (gps.length > 0) {
    const g = gps[0];
    console.log(`   Device ID: ${g.starline_device_id}`);
    console.log(`   Alias: ${g.starline_alias}`);
    console.log(`   Car ID: ${g.car_id}`);
    console.log(`   Last sync: ${g.last_sync}`);
    console.log(`   Current timestamp: ${g.current_timestamp}`);
    console.log(`   Updated at: ${g.updated_at}`);
    
    const lastSync = new Date(g.last_sync);
    const now = new Date();
    const diffHours = Math.round((now - lastSync) / (1000 * 60 * 60));
    const diffDays = Math.round((now - lastSync) / (1000 * 60 * 60 * 24));
    
    console.log(`\n   ⏰ Время с последней синхронизации: ${diffHours} часов (${diffDays} дней)`);
    
    if (diffHours > 24) {
      console.log(`   ⚠️ ВНИМАНИЕ: Данные не обновлялись более 24 часов!`);
    }
  } else {
    console.log('   ⚠️ GPS данные не найдены');
  }

  // Проверяем последние события в timeline
  const timeline = await sql`
    SELECT 
      ts,
      summary,
      details
    FROM entity_timeline
    WHERE entity_type = 'car'
      AND entity_id IN (SELECT id FROM cars WHERE plate = 'OB700OB')
      AND source_type = 'starline'
      AND event_type = 'car.gps_updated'
    ORDER BY ts DESC
    LIMIT 1
  `;

  console.log('\n📜 Последнее событие в timeline:');
  if (timeline.length > 0) {
    const t = timeline[0];
    console.log(`   Время: ${t.ts}`);
    console.log(`   Сводка: ${t.summary}`);
    
    const eventTime = new Date(t.ts);
    const now = new Date();
    const diffHours = Math.round((now - eventTime) / (1000 * 60 * 60));
    
    console.log(`   ⏰ Время с последнего события: ${diffHours} часов`);
  } else {
    console.log('   ⚠️ События не найдены');
  }

  // Проверяем устройство в starline_devices
  const [device] = await sql`
    SELECT 
      device_id,
      alias,
      plate,
      car_id,
      matched,
      active,
      last_seen
    FROM starline_devices
    WHERE device_id = 864326066742275
  `;

  console.log('\n📡 Устройство в starline_devices:');
  if (device) {
    console.log(`   Device ID: ${device.device_id}`);
    console.log(`   Alias: ${device.alias}`);
    console.log(`   Plate: ${device.plate}`);
    console.log(`   Car ID: ${device.car_id}`);
    console.log(`   Matched: ${device.matched}`);
    console.log(`   Active: ${device.active}`);
    console.log(`   Last seen: ${device.last_seen}`);
    
    const lastSeen = new Date(device.last_seen);
    const now = new Date();
    const diffHours = Math.round((now - lastSeen) / (1000 * 60 * 60));
    
    console.log(`   ⏰ Время с последнего обнаружения: ${diffHours} часов`);
  }

} catch (error) {
  console.error('❌ Ошибка:', error);
} finally {
  await sql.end();
}

