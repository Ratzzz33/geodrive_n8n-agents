import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔍 Проверка почему OB700OB не обновляется\n');

  // 1. Проверяем устройство в starline_devices
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

  console.log('📡 Устройство в starline_devices:');
  console.log(JSON.stringify(device, null, 2));
  console.log('');

  // 2. Проверяем последние GPS данные
  const [gps] = await sql`
    SELECT 
      car_id,
      starline_device_id,
      starline_alias,
      last_sync,
      current_timestamp
    FROM gps_tracking
    WHERE starline_device_id = 864326066742275
    ORDER BY last_sync DESC
    LIMIT 1
  `;

  console.log('📍 Последние GPS данные:');
  console.log(JSON.stringify(gps, null, 2));
  console.log('');

  // 3. Проверяем машину
  const [car] = await sql`
    SELECT id, plate, model
    FROM cars
    WHERE plate = 'OB700OB'
  `;

  console.log('🚗 Машина OB700OB:');
  console.log(JSON.stringify(car, null, 2));
  console.log('');

  // 4. Проверяем сопоставление
  console.log('🔗 Проверка сопоставления:');
  if (device && car) {
    if (device.car_id === car.id) {
      console.log('   ✅ Устройство правильно привязано к машине');
    } else {
      console.log(`   ⚠️ Устройство привязано к другой машине!`);
      console.log(`      Device car_id: ${device.car_id}`);
      console.log(`      Car id: ${car.id}`);
    }
    
    if (device.matched) {
      console.log('   ✅ Устройство помечено как сопоставленное');
    } else {
      console.log('   ⚠️ Устройство НЕ помечено как сопоставленное!');
    }
    
    if (device.active) {
      console.log('   ✅ Устройство активно');
    } else {
      console.log('   ⚠️ Устройство НЕ активно!');
    }
  }

  // 5. Проверяем логику matchCars - какие устройства должны обрабатываться
  console.log('\n🔍 Симуляция логики matchCars():');
  const deviceMappings = await sql`
    SELECT 
      sd.device_id,
      sd.alias,
      sd.car_id,
      sd.matched,
      c.plate,
      c.model
    FROM starline_devices sd
    JOIN cars c ON c.id = sd.car_id
    WHERE sd.matched = TRUE
      AND sd.active = TRUE
      AND sd.device_id = 864326066742275
  `;

  if (deviceMappings.length > 0) {
    console.log('   ✅ Устройство найдено в deviceMappings (должно обрабатываться)');
    console.log(JSON.stringify(deviceMappings[0], null, 2));
  } else {
    console.log('   ⚠️ Устройство НЕ найдено в deviceMappings (НЕ будет обрабатываться!)');
    console.log('   Причины могут быть:');
    console.log('      - matched = FALSE');
    console.log('      - active = FALSE');
    console.log('      - car_id = NULL');
  }

} catch (error) {
  console.error('❌ Ошибка:', error);
} finally {
  await sql.end();
}

