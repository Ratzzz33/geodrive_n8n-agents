import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('='.repeat(60));
  console.log('🚗 Mercedes Benz GLE 350 (OB700OB) - Полные данные');
  console.log('='.repeat(60));
  
  // 1. Данные машины
  console.log('\n📋 1. Данные машины из таблицы cars:');
  const car = await sql`
    SELECT 
      id,
      plate,
      car_visual_name as brand,
      model,
      created_at,
      updated_at
    FROM cars
    WHERE plate = 'OB700OB'
  `;
  
  if (car.length === 0) {
    console.log('❌ Машина не найдена!');
    process.exit(1);
  }
  
  const carData = car[0];
  console.log(`   ID: ${carData.id}`);
  console.log(`   Номер: ${carData.plate}`);
  console.log(`   Бренд: ${carData.brand}`);
  console.log(`   Модель: ${carData.model}`);
  console.log(`   Создана: ${carData.created_at}`);
  console.log(`   Обновлена: ${carData.updated_at}`);
  
  // 2. Данные Starline устройства
  console.log('\n📡 2. Данные Starline устройства из starline_devices:');
  const device = await sql`
    SELECT 
      device_id,
      alias,
      car_id,
      matched,
      match_confidence,
      match_method,
      extracted_model,
      plate,
      active,
      created_at,
      updated_at
    FROM starline_devices
    WHERE car_id = ${carData.id}
  `;
  
  if (device.length === 0) {
    console.log('❌ Устройство Starline не найдено для этой машины!');
  } else {
    const dev = device[0];
    console.log(`   Device ID (IMEI): ${dev.device_id}`);
    console.log(`   Alias: ${dev.alias}`);
    console.log(`   Matched: ${dev.matched}`);
    console.log(`   Match confidence: ${dev.match_confidence}`);
    console.log(`   Match method: ${dev.match_method}`);
    console.log(`   Extracted model: ${dev.extracted_model}`);
    console.log(`   Plate: ${dev.plate}`);
    console.log(`   Active: ${dev.active}`);
    console.log(`   Создано: ${dev.created_at}`);
    console.log(`   Обновлено: ${dev.updated_at}`);
  }
  
  // 3. Текущее GPS положение
  console.log('\n📍 3. Текущее GPS положение из gps_tracking:');
  const currentGPS = await sql`
    SELECT 
      starline_device_id,
      starline_alias,
      current_lat,
      current_lng,
      current_sat_qty,
      current_timestamp,
      status,
      is_moving,
      distance_moved,
      speed,
      google_maps_link,
      gps_level,
      gsm_level,
      ignition_on,
      engine_running,
      parking_brake,
      battery_voltage,
      last_activity,
      last_sync
    FROM gps_tracking
    WHERE car_id = ${carData.id}
  `;
  
  if (currentGPS.length === 0) {
    console.log('❌ GPS данные не найдены!');
  } else {
    const gps = currentGPS[0];
    console.log(`   Device ID: ${gps.starline_device_id}`);
    console.log(`   Alias: ${gps.starline_alias}`);
    console.log(`   Координаты: ${gps.current_lat}, ${gps.current_lng}`);
    console.log(`   Спутников: ${gps.current_sat_qty}`);
    console.log(`   Время GPS: ${gps.current_timestamp}`);
    console.log(`   Статус: ${gps.status}`);
    console.log(`   В движении: ${gps.is_moving}`);
    console.log(`   Пройдено (м): ${gps.distance_moved}`);
    console.log(`   Скорость (км/ч): ${gps.speed}`);
    console.log(`   GPS уровень: ${gps.gps_level}%`);
    console.log(`   GSM уровень: ${gps.gsm_level}%`);
    console.log(`   Зажигание: ${gps.ignition_on}`);
    console.log(`   Двигатель: ${gps.engine_running}`);
    console.log(`   Ручник: ${gps.parking_brake}`);
    console.log(`   Напряжение АКБ: ${gps.battery_voltage}V`);
    console.log(`   Последняя активность: ${gps.last_activity}`);
    console.log(`   Последняя синхронизация: ${gps.last_sync}`);
    console.log(`\n   🗺️  Google Maps: ${gps.google_maps_link}`);
  }
  
  // 4. Последние 10 GPS событий
  console.log('\n📜 4. Последние 10 GPS событий из entity_timeline:');
  const timeline = await sql`
    SELECT 
      event_type,
      data,
      created_at
    FROM entity_timeline
    WHERE entity_type = 'car'
      AND entity_id = ${carData.id}
      AND event_type LIKE 'gps.%'
    ORDER BY created_at DESC
    LIMIT 10
  `;
  
  if (timeline.length === 0) {
    console.log('   ℹ️  GPS события не найдены');
  } else {
    console.log(`   Найдено событий: ${timeline.length}\n`);
    
    timeline.forEach((event, index) => {
      const data = typeof event.data === 'string' 
        ? JSON.parse(event.data) 
        : event.data;
      
      console.log(`   ${index + 1}. ${event.event_type} - ${event.created_at}`);
      console.log(`      Координаты: ${data.lat || data.current_lat}, ${data.lng || data.current_lng}`);
      console.log(`      Статус: ${data.status || 'N/A'}, Скорость: ${data.speed || 0} км/ч`);
      
      if (data.lat && data.lng) {
        console.log(`      Maps: https://www.google.com/maps?q=${data.lat},${data.lng}`);
      } else if (data.current_lat && data.current_lng) {
        console.log(`      Maps: https://www.google.com/maps?q=${data.current_lat},${data.current_lng}`);
      }
      console.log('');
    });
  }
  
  console.log('='.repeat(60));
  
} catch (error) {
  console.error('❌ ERROR:', error.message);
  if (error.detail) {
    console.error('   Detail:', error.detail);
  }
  if (error.stack) {
    console.error('   Stack:', error.stack);
  }
} finally {
  await sql.end();
}

