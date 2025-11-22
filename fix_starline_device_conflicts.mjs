import postgres from 'postgres';

const CONNECTION_STRING =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false },
});

const FIX_LABEL = 'Manual fix 2025-11-16: rebind starline devices';

const desiredMappings = [
  { plate: 'BE021ES', carName: 'Toyota Rav 4', deviceId: 864107072502972 },
  { plate: 'CT021CT', carName: 'Fiesta SE', deviceId: 864326062571934 },
  { plate: 'RL630RL', carName: 'Mini Cabrio', deviceId: 864326062726496 },
  { plate: 'UU630UL', carName: 'Tiguan White', deviceId: 864326067210124 },
  { plate: 'RR350FR', carName: 'Kia Sportage', deviceId: 868613069004407 },
  { plate: 'ZR350RZ', carName: 'Prius White', deviceId: 864326067133011 },
];

const normalizePlate = (plate) => plate.replace(/\s+/g, '').toUpperCase();

async function findCar(mapping) {
  const [car] = await sql`
    SELECT id, plate, car_visual_name, model
    FROM cars
    WHERE UPPER(REPLACE(plate, ' ', '')) = ${normalizePlate(mapping.plate)}
    LIMIT 1
  `;
  return car;
}

async function findDevice(mapping) {
  const [device] = await sql`
    SELECT id, device_id, alias, car_id, matched
    FROM starline_devices
    WHERE device_id = ${mapping.deviceId}
    LIMIT 1
  `;
  return device;
}

async function logHistory(deviceId, carId, matched, method, alias, carPlate, reason) {
  await sql`
    INSERT INTO starline_match_history (
      starline_device_id,
      car_id,
      matched,
      method,
      starline_alias,
      car_license_plate,
      reason,
      created_by
    ) VALUES (
      ${deviceId},
      ${carId},
      ${matched},
      ${method},
      ${alias},
      ${carPlate},
      ${reason},
      'system_fix'
    )
  `;
}

async function detachDeviceFromOldCar(device, targetCar, mapping) {
  if (!device.car_id || device.car_id === targetCar.id) {
    return;
  }

  const [oldCar] = await sql`
    SELECT plate
    FROM cars
    WHERE id = ${device.car_id}
    LIMIT 1
  `;

  const oldPlate = oldCar?.plate || 'UNKNOWN';
  console.log(
    `   ⚠️ Устройство ${device.device_id} (${device.alias}) привязано к ${oldPlate}, отвязываю...`,
  );

  await logHistory(
    device.id,
    device.car_id,
    false,
    'manual_unmatch',
    device.alias,
    oldPlate,
    `${FIX_LABEL}. Отвязано от ${oldPlate}, должно быть ${mapping.plate}`,
  );

  await sql`
    UPDATE starline_devices
    SET
      car_id = NULL,
      matched = FALSE,
      match_confidence = NULL,
      match_method = NULL,
      match_notes = ${`${FIX_LABEL}. Unmatched from ${oldPlate}`},
      updated_at = NOW()
    WHERE id = ${device.id}
  `;
}

async function detachOtherDevicesFromCar(car, mapping) {
  const otherDevices = await sql`
    SELECT id, device_id, alias
    FROM starline_devices
    WHERE car_id = ${car.id}
      AND device_id != ${mapping.deviceId}
  `;

  if (otherDevices.length === 0) {
    return;
  }

  console.log(`   ⚠️ Найдено ${otherDevices.length} других устройств у машины ${car.plate}, отвязываю...`);

  for (const other of otherDevices) {
    await logHistory(
      other.id,
      car.id,
      false,
      'manual_unmatch',
      other.alias,
      car.plate,
      `${FIX_LABEL}. Освобождаем машину для ${mapping.deviceId}`,
    );

    await sql`
      UPDATE starline_devices
      SET
        car_id = NULL,
        matched = FALSE,
        match_confidence = NULL,
        match_method = NULL,
        match_notes = ${`${FIX_LABEL}. Cleared conflict for ${car.plate}`},
        updated_at = NOW()
      WHERE id = ${other.id}
    `;
  }
}

async function attachDevice(device, car, mapping) {
  console.log(`   🔗 Привязываю устройство ${device.device_id} к ${car.plate}...`);

  await sql`
    UPDATE starline_devices
    SET
      car_id = ${car.id},
      matched = TRUE,
      match_confidence = 1.00,
      match_method = 'manual',
      match_notes = ${`${FIX_LABEL}. ${mapping.carName} (${mapping.plate})`},
      plate = ${car.plate},
      last_seen = NOW(),
      updated_at = NOW()
    WHERE id = ${device.id}
  `;

  await logHistory(
    device.id,
    car.id,
    true,
    'manual',
    device.alias,
    car.plate,
    `${FIX_LABEL}. Привязано к ${mapping.carName} (${mapping.plate})`,
  );
}

async function processMapping(mapping) {
  console.log(`\n🚗 Обработка ${mapping.carName} (${mapping.plate}) -> ${mapping.deviceId}`);

  const car = await findCar(mapping);
  if (!car) {
    console.log(`   ❌ Машина ${mapping.plate} не найдена в cars`);
    return;
  }
  console.log(`   ✅ Найдена машина: ${car.car_visual_name || car.model || mapping.carName}`);

  const device = await findDevice(mapping);
  if (!device) {
    console.log(`   ❌ Устройство ${mapping.deviceId} не найдено в starline_devices`);
    return;
  }
  console.log(`   ✅ Найдено устройство: ${device.alias}`);

  await detachDeviceFromOldCar(device, car, mapping);
  await detachOtherDevicesFromCar(car, mapping);

  if (device.car_id !== car.id) {
    await attachDevice(device, car, mapping);
    console.log('   ✅ Устройство перепривязано');
  } else {
    console.log('   ✅ Устройство уже привязано правильно, обновляю метаданные');
    await sql`
      UPDATE starline_devices
      SET
        match_confidence = 1.00,
        match_method = 'manual',
        match_notes = ${`${FIX_LABEL}. Подтверждено`},
        plate = ${car.plate},
        last_seen = NOW(),
        updated_at = NOW()
      WHERE id = ${device.id}
    `;
  }
}

async function showSummary() {
  console.log('\n📊 Итоговое состояние устройств:');

  for (const mapping of desiredMappings) {
    const [row] = await sql`
      SELECT
        sd.device_id,
        sd.alias,
        sd.matched,
        sd.match_method,
        sd.match_confidence,
        c.plate as car_plate,
        c.car_visual_name as car_name
      FROM starline_devices sd
      LEFT JOIN cars c ON c.id = sd.car_id
      WHERE sd.device_id = ${mapping.deviceId}
      LIMIT 1
    `;

    if (!row) {
      console.log(`   ❌ ${mapping.deviceId}: запись не найдена`);
      continue;
    }

    console.log(
      `   ${row.device_id}: ${row.alias} -> ${row.car_plate || 'NULL'} (${row.car_name || 'нет имени'})`,
    );
  }
}

async function main() {
  try {
    console.log('🔧 Исправление конфликтов устройств Starline (manual fix)');
    for (const mapping of desiredMappings) {
      await processMapping(mapping);
    }
    await showSummary();
    console.log('\n✅ Готово');
  } catch (error) {
    console.error('❌ Ошибка при исправлении:', error);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();


