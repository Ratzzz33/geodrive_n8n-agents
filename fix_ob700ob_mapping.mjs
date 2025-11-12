import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔧 Исправление сопоставления для Mercedes Benz GLE 350 (OB700OB)\n');

  // Находим правильную машину OB700OB
  const [ob700obCar] = await sql`
    SELECT id, plate, model, car_visual_name
    FROM cars
    WHERE plate = 'OB700OB'
  `;

  if (!ob700obCar) {
    console.error('❌ Машина OB700OB не найдена!');
    process.exit(1);
  }

  console.log(`✅ Найдена машина OB700OB:`);
  console.log(`   ID: ${ob700obCar.id}`);
  console.log(`   Модель: ${ob700obCar.model}`);
  console.log(`   Бренд: ${ob700obCar.car_visual_name || 'NULL'}\n`);

  // Находим устройство
  const [device] = await sql`
    SELECT id, device_id, alias, car_id, plate, matched
    FROM starline_devices
    WHERE device_id = 864326066742275
  `;

  if (!device) {
    console.error('❌ Устройство 864326066742275 не найдено!');
    process.exit(1);
  }

  console.log(`📡 Текущее состояние устройства:`);
  console.log(`   Device ID: ${device.device_id}`);
  console.log(`   Alias: ${device.alias}`);
  console.log(`   Текущий Car ID: ${device.car_id || 'NULL'}`);
  console.log(`   Текущий Plate: ${device.plate || 'NULL'}`);
  console.log(`   Сопоставлено: ${device.matched ? 'Да' : 'Нет'}\n`);

  // Проверяем что в gps_tracking
  const [gpsData] = await sql`
    SELECT car_id, starline_device_id, starline_alias
    FROM gps_tracking
    WHERE starline_device_id = 864326066742275
    ORDER BY last_sync DESC
    LIMIT 1
  `;

  if (gpsData) {
    console.log(`📍 Данные из gps_tracking:`);
    console.log(`   Car ID: ${gpsData.car_id}`);
    console.log(`   Alias: ${gpsData.starline_alias}\n`);
  }

  // Исправляем сопоставление
  console.log(`🔧 Исправляю сопоставление...\n`);

  const result = await sql`
    UPDATE starline_devices
    SET 
      car_id = ${ob700obCar.id},
      plate = ${ob700obCar.plate},
      matched = TRUE,
      match_confidence = 1.00,
      match_method = 'manual_fix',
      match_notes = ${`Исправлено вручную: правильное сопоставление для OB700OB (Mercedes Benz GLE 350)`},
      extracted_model = ${ob700obCar.model},
      last_seen = NOW(),
      updated_at = NOW()
    WHERE device_id = 864326066742275
    RETURNING id, device_id, alias, plate, car_id, matched, extracted_model
  `;

  if (result.length > 0) {
    const updated = result[0];
    console.log(`✅ Сопоставление исправлено!`);
    console.log(`\n   Device ID: ${updated.device_id}`);
    console.log(`   Alias: ${updated.alias}`);
    console.log(`   Plate: ${updated.plate}`);
    console.log(`   Car ID: ${updated.car_id}`);
    console.log(`   Сопоставлено: ${updated.matched ? '✅ Да' : '❌ Нет'}`);
    console.log(`   Извлеченная модель: ${updated.extracted_model}`);
  } else {
    console.error('❌ Не удалось обновить сопоставление!');
  }

  // Проверяем результат
  console.log(`\n🔍 Проверка результата:\n`);
  const check = await sql`
    SELECT 
      sd.device_id,
      sd.alias,
      sd.plate,
      sd.car_id,
      sd.matched,
      sd.extracted_model,
      c.plate as car_plate,
      c.model as car_model,
      c.car_visual_name as car_brand
    FROM starline_devices sd
    LEFT JOIN cars c ON c.id = sd.car_id
    WHERE sd.device_id = 864326066742275
  `;

  if (check.length > 0) {
    const c = check[0];
    console.log(`   Device ID: ${c.device_id}`);
    console.log(`   Alias: ${c.alias}`);
    console.log(`   Starline plate: ${c.plate || 'NULL'}`);
    console.log(`   Car plate: ${c.car_plate || 'NULL'} ${c.plate === c.car_plate ? '✅' : '⚠️'}`);
    console.log(`   Car model: ${c.car_model || 'NULL'} ${c.extracted_model === c.car_model ? '✅' : '⚠️'}`);
    console.log(`   Car brand: ${c.car_brand || 'NULL'}`);
    console.log(`   Сопоставлено: ${c.matched ? '✅ Да' : '❌ Нет'}`);
  }

} catch (error) {
  console.error('❌ Ошибка:', error);
} finally {
  await sql.end();
}

