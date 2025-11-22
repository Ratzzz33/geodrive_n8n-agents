import postgres from 'postgres';

const CONNECTION_STRING =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false },
});

const FIX_LABEL = 'Manual fix 2025-11-16: correct wrong device bindings';

// Правильные привязки
const correctBindings = [
  {
    deviceId: 869573070849134,
    deviceAlias: 'Countryman Blue 972',
    targetPlate: 'HH972LH',
    targetCarName: 'Mini Countryman',
  },
  {
    deviceId: 864326067074728,
    deviceAlias: 'Santafe Black OC700OC',
    targetPlate: 'OC700OC',
    targetCarName: 'Santafe Black',
  },
  {
    deviceId: 869573078709165,
    deviceAlias: 'Toyota Camry DK700DK',
    targetPlate: 'DK700DK',
    targetCarName: 'Toyota Camry',
  },
];

const normalizePlate = (plate) => plate.replace(/\s+/g, '').toUpperCase();

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

async function fixBinding(binding) {
  console.log(
    `\n🔧 Исправление: Device ${binding.deviceId} (${binding.deviceAlias}) → ${binding.targetPlate}`,
  );

  // 1. Находим машину
  const [car] = await sql`
    SELECT id, plate, car_visual_name, model
    FROM cars
    WHERE UPPER(REPLACE(plate, ' ', '')) = ${normalizePlate(binding.targetPlate)}
    LIMIT 1
  `;

  if (!car) {
    console.log(`   ❌ Машина ${binding.targetPlate} не найдена в БД`);
    return false;
  }
  console.log(`   ✅ Найдена машина: ${car.car_visual_name || car.model} (${car.plate})`);

  // 2. Находим устройство
  const [device] = await sql`
    SELECT id, device_id, alias, car_id, matched
    FROM starline_devices
    WHERE device_id = ${binding.deviceId}
    LIMIT 1
  `;

  if (!device) {
    console.log(`   ❌ Устройство ${binding.deviceId} не найдено в БД`);
    return false;
  }
  console.log(`   ✅ Найдено устройство: ${device.alias}`);

  // 3. Отвязываем устройство от старой машины (если была)
  if (device.car_id && device.car_id !== car.id) {
    const [oldCar] = await sql`
      SELECT plate FROM cars WHERE id = ${device.car_id} LIMIT 1
    `;
    const oldPlate = oldCar?.plate || 'UNKNOWN';

    console.log(`   ⚠️ Отвязываю от старой машины: ${oldPlate}`);

    await logHistory(
      device.id,
      device.car_id,
      false,
      'manual_unmatch',
      device.alias,
      oldPlate,
      `${FIX_LABEL}. Отвязано от ${oldPlate}, правильная машина: ${binding.targetPlate}`,
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

  // 4. Отвязываем другие устройства от целевой машины
  const otherDevices = await sql`
    SELECT id, device_id, alias
    FROM starline_devices
    WHERE car_id = ${car.id}
      AND device_id != ${binding.deviceId}
  `;

  if (otherDevices.length > 0) {
    console.log(`   ⚠️ Отвязываю ${otherDevices.length} других устройств от ${car.plate}`);
    for (const other of otherDevices) {
      await logHistory(
        other.id,
        car.id,
        false,
        'manual_unmatch',
        other.alias,
        car.plate,
        `${FIX_LABEL}. Освобождаем машину для ${binding.deviceId}`,
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

  // 5. Привязываем правильное устройство
  if (device.car_id !== car.id) {
    console.log(`   🔗 Привязываю устройство к машине...`);

    await sql`
      UPDATE starline_devices
      SET
        car_id = ${car.id},
        matched = TRUE,
        match_confidence = 1.00,
        match_method = 'manual',
        match_notes = ${`${FIX_LABEL}. ${binding.targetCarName} (${binding.targetPlate})`},
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
      `${FIX_LABEL}. Привязано к ${binding.targetCarName} (${binding.targetPlate})`,
    );

    console.log(`   ✅ Устройство успешно привязано!`);
    return true;
  } else {
    console.log(`   ✅ Устройство уже правильно привязано, обновляю метаданные`);
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
    return true;
  }
}

async function checkDuplicates() {
  console.log('\n' + '═'.repeat(100));
  console.log('\n🔍 ПРОВЕРКА ДУБЛИКАТОВ\n');

  // Проверка: машины с несколькими устройствами
  const carsWithMultipleDevices = await sql`
    SELECT
      c.id,
      c.plate,
      c.car_visual_name,
      c.model,
      COUNT(sd.id) as device_count,
      ARRAY_AGG(sd.device_id ORDER BY sd.device_id) as device_ids,
      ARRAY_AGG(sd.alias ORDER BY sd.device_id) as device_aliases
    FROM cars c
    JOIN starline_devices sd ON sd.car_id = c.id
    WHERE sd.matched = TRUE
    GROUP BY c.id, c.plate, c.car_visual_name, c.model
    HAVING COUNT(sd.id) > 1
    ORDER BY c.plate
  `;

  if (carsWithMultipleDevices.length > 0) {
    console.log(`⚠️ Найдено ${carsWithMultipleDevices.length} машин с несколькими устройствами:\n`);
    for (const car of carsWithMultipleDevices) {
      console.log(`   ${car.plate} (${car.car_visual_name || car.model}):`);
      console.log(`      Устройств: ${car.device_count}`);
      for (let i = 0; i < car.device_ids.length; i++) {
        console.log(`      - ${car.device_ids[i]}: ${car.device_aliases[i]}`);
      }
      console.log('');
    }
  } else {
    console.log('✅ Нет машин с несколькими устройствами\n');
  }

  // Проверка: устройства с несколькими машинами (не должно быть, но проверим)
  const devicesWithMultipleCars = await sql`
    SELECT
      sd.device_id,
      sd.alias,
      COUNT(DISTINCT sd.car_id) as car_count
    FROM starline_devices sd
    WHERE sd.matched = TRUE AND sd.car_id IS NOT NULL
    GROUP BY sd.device_id, sd.alias
    HAVING COUNT(DISTINCT sd.car_id) > 1
    ORDER BY sd.device_id
  `;

  if (devicesWithMultipleCars.length > 0) {
    console.log(`⚠️ Найдено ${devicesWithMultipleCars.length} устройств с несколькими машинами:\n`);
    for (const device of devicesWithMultipleCars) {
      console.log(`   Device ${device.device_id} (${device.alias}): ${device.car_count} машин`);
    }
    console.log('');
  } else {
    console.log('✅ Нет устройств с несколькими машинами\n');
  }

  // Проверка: устройства без привязки (matched = TRUE но car_id = NULL - не должно быть)
  const matchedWithoutCar = await sql`
    SELECT device_id, alias
    FROM starline_devices
    WHERE matched = TRUE AND car_id IS NULL
    ORDER BY device_id
    LIMIT 10
  `;

  if (matchedWithoutCar.length > 0) {
    console.log(`⚠️ Найдено ${matchedWithoutCar.length} устройств с matched=TRUE но без car_id:\n`);
    for (const device of matchedWithoutCar) {
      console.log(`   Device ${device.device_id}: ${device.alias}`);
    }
    console.log('');
  } else {
    console.log('✅ Нет устройств с matched=TRUE но без car_id\n');
  }

  return {
    carsWithMultipleDevices: carsWithMultipleDevices.length,
    devicesWithMultipleCars: devicesWithMultipleCars.length,
    matchedWithoutCar: matchedWithoutCar.length,
  };
}

async function main() {
  try {
    console.log('🔧 Исправление неправильных привязок устройств Starline');
    console.log('═'.repeat(100));

    // Исправляем привязки
    for (const binding of correctBindings) {
      await fixBinding(binding);
    }

    // Проверяем дубликаты
    const duplicates = await checkDuplicates();

    console.log('═'.repeat(100));
    console.log('\n📊 ИТОГИ ПРОВЕРКИ:');
    console.log(`   Машин с несколькими устройствами: ${duplicates.carsWithMultipleDevices}`);
    console.log(`   Устройств с несколькими машинами: ${duplicates.devicesWithMultipleCars}`);
    console.log(`   Устройств с matched=TRUE но без car_id: ${duplicates.matchedWithoutCar}`);

    if (
      duplicates.carsWithMultipleDevices === 0 &&
      duplicates.devicesWithMultipleCars === 0 &&
      duplicates.matchedWithoutCar === 0
    ) {
      console.log('\n✅ Все проверки пройдены! Нет дубликатов.\n');
    } else {
      console.log('\n⚠️ Обнаружены проблемы, требуют внимания!\n');
    }
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();

