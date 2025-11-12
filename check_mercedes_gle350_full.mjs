import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔍 Полные данные по Mercedes Benz GLE 350\n');
  console.log('════════════════════════════════════════════════════════════════════════════════\n');

  // 1. Данные машины из cars
  const car = await sql`
    SELECT 
      id,
      plate,
      model,
      car_visual_name,
      branch_id,
      created_at,
      updated_at
    FROM cars
    WHERE plate = 'OB700OB' OR model LIKE '%GLE 350%'
    ORDER BY plate
  `;

  console.log('🚗 ДАННЫЕ МАШИНЫ (cars):');
  for (const c of car) {
    console.log(`\n   ID: ${c.id}`);
    console.log(`   Номер: ${c.plate}`);
    console.log(`   Модель: ${c.model}`);
    console.log(`   Бренд: ${c.car_visual_name || 'NULL'}`);
    console.log(`   Филиал ID: ${c.branch_id || 'NULL'}`);
    console.log(`   Создано: ${c.created_at}`);
    console.log(`   Обновлено: ${c.updated_at}`);
  }

  // 2. Устройство Starline из starline_devices
  const devices = await sql`
    SELECT 
      sd.id,
      sd.device_id,
      sd.alias,
      sd.plate,
      sd.car_id,
      sd.matched,
      sd.match_confidence,
      sd.match_method,
      sd.match_notes,
      sd.extracted_model,
      sd.extracted_digits,
      sd.imei,
      sd.phone,
      sd.sn,
      sd.device_type,
      sd.fw_version,
      sd.active,
      sd.first_seen,
      sd.last_seen,
      sd.created_at,
      sd.updated_at
    FROM starline_devices sd
    WHERE sd.plate = 'OB700OB' 
       OR sd.device_id = 864326066742275
       OR sd.car_id IN (SELECT id FROM cars WHERE plate = 'OB700OB')
    ORDER BY sd.device_id
  `;

  console.log('\n\n📡 УСТРОЙСТВА STARLINE (starline_devices):');
  for (const d of devices) {
    console.log(`\n   ID: ${d.id}`);
    console.log(`   Device ID (IMEI): ${d.device_id}`);
    console.log(`   Alias: ${d.alias}`);
    console.log(`   Plate: ${d.plate || 'NULL'}`);
    console.log(`   Car ID: ${d.car_id || 'NULL'}`);
    console.log(`   Сопоставлено: ${d.matched ? '✅ Да' : '❌ Нет'}`);
    console.log(`   Уверенность: ${d.match_confidence || 'NULL'}`);
    console.log(`   Метод: ${d.match_method || 'NULL'}`);
    console.log(`   Заметки: ${d.match_notes || 'NULL'}`);
    console.log(`   Извлеченная модель: ${d.extracted_model || 'NULL'}`);
    console.log(`   Извлеченные цифры: ${d.extracted_digits || 'NULL'}`);
    console.log(`   IMEI: ${d.imei || 'NULL'}`);
    console.log(`   Телефон: ${d.phone || 'NULL'}`);
    console.log(`   Серийный номер: ${d.sn || 'NULL'}`);
    console.log(`   Тип устройства: ${d.device_type || 'NULL'}`);
    console.log(`   Версия прошивки: ${d.fw_version || 'NULL'}`);
    console.log(`   Активно: ${d.active ? '✅ Да' : '❌ Нет'}`);
    console.log(`   Первое обнаружение: ${d.first_seen}`);
    console.log(`   Последнее обнаружение: ${d.last_seen}`);
    console.log(`   Создано: ${d.created_at}`);
    console.log(`   Обновлено: ${d.updated_at}`);
  }

  // 3. GPS данные из gps_tracking
  const gps = await sql`
    SELECT 
      gt.id,
      gt.car_id,
      gt.starline_device_id,
      gt.starline_alias,
      gt.current_lat,
      gt.current_lng,
      gt.current_sat_qty,
      gt.current_timestamp,
      gt.previous_lat,
      gt.previous_lng,
      gt.previous_sat_qty,
      gt.previous_timestamp,
      gt.status,
      gt.is_moving,
      gt.distance_moved,
      gt.speed,
      gt.google_maps_link,
      gt.gps_level,
      gt.gsm_level,
      gt.ignition_on,
      gt.engine_running,
      gt.parking_brake,
      gt.battery_voltage,
      gt.last_activity,
      gt.last_sync,
      gt.created_at,
      gt.updated_at
    FROM gps_tracking gt
    WHERE gt.car_id IN (SELECT id FROM cars WHERE plate = 'OB700OB')
       OR gt.starline_device_id = 864326066742275
    ORDER BY gt.last_sync DESC
    LIMIT 1
  `;

  console.log('\n\n📍 GPS ДАННЫЕ (gps_tracking):');
  if (gps.length > 0) {
    const g = gps[0];
    console.log(`\n   ID: ${g.id}`);
    console.log(`   Car ID: ${g.car_id}`);
    console.log(`   Device ID: ${g.starline_device_id}`);
    console.log(`   Alias: ${g.starline_alias}`);
    console.log(`\n   Текущее положение:`);
    console.log(`      Широта: ${g.current_lat}`);
    console.log(`      Долгота: ${g.current_lng}`);
    console.log(`      Спутники: ${g.current_sat_qty}`);
    console.log(`      Время: ${g.current_timestamp}`);
    console.log(`      Карта: ${g.google_maps_link}`);
    console.log(`\n   Предыдущее положение:`);
    console.log(`      Широта: ${g.previous_lat || 'NULL'}`);
    console.log(`      Долгота: ${g.previous_lng || 'NULL'}`);
    console.log(`      Спутники: ${g.previous_sat_qty || 'NULL'}`);
    console.log(`      Время: ${g.previous_timestamp || 'NULL'}`);
    console.log(`\n   Статус и движение:`);
    console.log(`      Статус: ${g.status}`);
    console.log(`      Движется: ${g.is_moving ? '✅ Да' : '❌ Нет'}`);
    console.log(`      Дистанция: ${g.distance_moved} м`);
    console.log(`      Скорость: ${g.speed} км/ч`);
    console.log(`\n   Состояние автомобиля:`);
    console.log(`      Зажигание: ${g.ignition_on ? '✅ Включено' : '❌ Выключено'}`);
    console.log(`      Двигатель: ${g.engine_running ? '✅ Работает' : '❌ Не работает'}`);
    console.log(`      Ручной тормоз: ${g.parking_brake ? '✅ Включен' : '❌ Выключен'}`);
    console.log(`      Напряжение АКБ: ${g.battery_voltage || 'NULL'} В`);
    console.log(`\n   Сигналы:`);
    console.log(`      GPS уровень: ${g.gps_level}`);
    console.log(`      GSM уровень: ${g.gsm_level}`);
    console.log(`      Последняя активность: ${g.last_activity}`);
    console.log(`      Последняя синхронизация: ${g.last_sync}`);
    console.log(`\n   Метаданные:`);
    console.log(`      Создано: ${g.created_at}`);
    console.log(`      Обновлено: ${g.updated_at}`);
  } else {
    console.log('\n   ⚠️ GPS данные не найдены');
  }

  // 4. Последние 5 записей из entity_timeline
  const timeline = await sql`
    SELECT 
      id,
      ts,
      entity_type,
      entity_id,
      source_type,
      event_type,
      summary,
      details,
      operation,
      created_at
    FROM entity_timeline
    WHERE entity_type = 'car'
      AND entity_id IN (SELECT id FROM cars WHERE plate = 'OB700OB')
      AND source_type = 'starline'
      AND event_type = 'car.gps_updated'
    ORDER BY ts DESC
    LIMIT 5
  `;

  console.log('\n\n📜 ПОСЛЕДНИЕ 5 GPS СОБЫТИЙ (entity_timeline):');
  if (timeline.length > 0) {
    for (let i = 0; i < timeline.length; i++) {
      const t = timeline[i];
      const details = typeof t.details === 'string' ? JSON.parse(t.details) : t.details;
      console.log(`\n   ${i + 1}. ${t.ts}`);
      console.log(`      Сводка: ${t.summary}`);
      console.log(`      Координаты: ${details.lat || 'N/A'}, ${details.lng || 'N/A'}`);
      console.log(`      Движется: ${details.isMoving ? '✅ Да' : '❌ Нет'}`);
      console.log(`      Дистанция: ${details.distanceMoved || 'N/A'} м`);
      console.log(`      Операция: ${t.operation}`);
      console.log(`      ID записи: ${t.id}`);
    }
  } else {
    console.log('\n   ⚠️ События не найдены');
  }

  // 5. Проверка сопоставлений
  console.log('\n\n🔗 ПРОВЕРКА СОПОСТАВЛЕНИЙ:');
  const mappingCheck = await sql`
    SELECT 
      sd.device_id,
      sd.alias as starline_alias,
      sd.plate as starline_plate,
      sd.car_id,
      sd.matched,
      c.plate as car_plate,
      c.model as car_model,
      c.car_visual_name as car_brand,
      CASE 
        WHEN sd.plate = c.plate THEN '✅'
        ELSE '⚠️'
      END as plate_match,
      CASE 
        WHEN sd.extracted_model = c.model THEN '✅'
        ELSE '⚠️'
      END as model_match
    FROM starline_devices sd
    LEFT JOIN cars c ON c.id = sd.car_id
    WHERE sd.plate = 'OB700OB' 
       OR sd.device_id = 864326066742275
       OR c.plate = 'OB700OB'
  `;

  for (const m of mappingCheck) {
    console.log(`\n   Device ID: ${m.device_id}`);
    console.log(`   Starline alias: ${m.starline_alias}`);
    console.log(`   Starline plate: ${m.starline_plate || 'NULL'}`);
    console.log(`   Car ID: ${m.car_id || 'NULL'}`);
    console.log(`   Car plate: ${m.car_plate || 'NULL'} ${m.plate_match || ''}`);
    console.log(`   Car model: ${m.car_model || 'NULL'} ${m.model_match || ''}`);
    console.log(`   Car brand: ${m.car_brand || 'NULL'}`);
    console.log(`   Сопоставлено: ${m.matched ? '✅ Да' : '❌ Нет'}`);
  }

  console.log('\n\n════════════════════════════════════════════════════════════════════════════════');
  console.log('✅ Проверка завершена!\n');

} catch (error) {
  console.error('❌ Ошибка:', error);
} finally {
  await sql.end();
}

