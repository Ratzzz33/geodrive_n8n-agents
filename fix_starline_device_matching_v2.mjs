import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

// Правильные сопоставления
const correctMappings = [
  {
    plate: 'OB700OB',
    carName: 'Mercedes Benz GLE 350',
    deviceId: 864326066742275,
    deviceAlias: 'MB GLE 20--700'
  },
  {
    plate: 'OC700OC',
    carName: 'Santafe Black',
    deviceId: 864326067074728,
    deviceAlias: 'Santafe Black OC700OC'
  },
  {
    plate: 'UQ089QQ',
    carName: 'MB E350 RED',
    deviceId: 868613068865584,
    deviceAlias: 'MB E350 RED UQ089QQ'
  },
  {
    plate: 'RR350FR',
    carName: 'Kia Sportage',
    deviceId: 868613069004407,
    deviceAlias: 'Sportage Gray RR350FR'
  }
];

async function fixDeviceMatching() {
  try {
    console.log('🔧 Исправление сопоставлений устройств Starline с машинами\n');
    console.log('═'.repeat(80));

    // ШАГ 1: Отвязываем все устройства от машин, которые не должны быть привязаны
    console.log('\n📋 ШАГ 1: Отвязка неправильных устройств\n');

    // Отвязываем Santafe Black OC700OC от Mercedes Benz GLE 350
    const mercedesCar = await sql`
      SELECT id, plate FROM cars
      WHERE UPPER(REPLACE(plate, ' ', '')) = 'OB700OB'
      LIMIT 1
    `;

    if (mercedesCar.length > 0) {
      const wrongDevice = await sql`
        SELECT id, device_id, alias FROM starline_devices
        WHERE device_id = 864326067074728 AND car_id = ${mercedesCar[0].id}
        LIMIT 1
      `;

      if (wrongDevice.length > 0) {
        console.log(`   Отвязываю ${wrongDevice[0].alias} от Mercedes Benz GLE 350...`);
        
        await sql`
          INSERT INTO starline_match_history (
            starline_device_id, car_id, matched, method,
            starline_alias, car_license_plate, reason, created_by
          ) VALUES (
            ${wrongDevice[0].id}, ${mercedesCar[0].id}, FALSE, 'manual_unmatch',
            ${wrongDevice[0].alias}, ${mercedesCar[0].plate},
            'Отвязано: должно быть привязано к Santafe Black (OC700OC)', 'system_fix'
          )
        `;

        await sql`
          UPDATE starline_devices
          SET car_id = NULL, matched = FALSE, match_confidence = NULL,
              match_method = NULL, match_notes = 'Отвязано: должно быть привязано к Santafe Black (OC700OC)',
              updated_at = NOW()
          WHERE id = ${wrongDevice[0].id}
        `;

        console.log(`   ✅ Отвязано`);
      }
    }

    // Отвязываем MB E350 RED от Kia Sportage
    const kiaCar = await sql`
      SELECT id, plate FROM cars
      WHERE UPPER(REPLACE(plate, ' ', '')) = 'RR350FR'
      LIMIT 1
    `;

    if (kiaCar.length > 0) {
      const wrongDevice2 = await sql`
        SELECT id, device_id, alias FROM starline_devices
        WHERE device_id = 868613068865584 AND car_id = ${kiaCar[0].id}
        LIMIT 1
      `;

      if (wrongDevice2.length > 0) {
        console.log(`   Отвязываю ${wrongDevice2[0].alias} от Kia Sportage...`);
        
        await sql`
          INSERT INTO starline_match_history (
            starline_device_id, car_id, matched, method,
            starline_alias, car_license_plate, reason, created_by
          ) VALUES (
            ${wrongDevice2[0].id}, ${kiaCar[0].id}, FALSE, 'manual_unmatch',
            ${wrongDevice2[0].alias}, ${kiaCar[0].plate},
            'Отвязано: должно быть привязано к MB E350 RED (UQ089QQ)', 'system_fix'
          )
        `;

        await sql`
          UPDATE starline_devices
          SET car_id = NULL, matched = FALSE, match_confidence = NULL,
              match_method = NULL, match_notes = 'Отвязано: должно быть привязано к MB E350 RED (UQ089QQ)',
              updated_at = NOW()
          WHERE id = ${wrongDevice2[0].id}
        `;

        console.log(`   ✅ Отвязано`);
      }
    }

    // ШАГ 2: Привязываем правильные устройства
    console.log('\n📋 ШАГ 2: Привязка правильных устройств\n');

    for (const mapping of correctMappings) {
      console.log(`\n📋 Обработка: ${mapping.carName} (${mapping.plate})`);
      console.log(`   Устройство: ${mapping.deviceAlias} (${mapping.deviceId})`);

      // 1. Находим или создаем машину
      let cars = await sql`
        SELECT id, plate, car_visual_name, model, branch_id
        FROM cars
        WHERE UPPER(REPLACE(plate, ' ', '')) = UPPER(REPLACE(${mapping.plate}, ' ', ''))
        LIMIT 1
      `;

      let car;
      if (cars.length === 0) {
        console.log(`   ⚠️  Машина не найдена, создаю...`);
        
        // Пытаемся найти филиал по умолчанию (Батуми)
        const branches = await sql`
          SELECT id FROM branches WHERE code = 'batumi' LIMIT 1
        `;
        
        const branchId = branches.length > 0 ? branches[0].id : null;
        
        const newCar = await sql`
          INSERT INTO cars (plate, car_visual_name, model, branch_id)
          VALUES (${mapping.plate}, ${mapping.carName}, ${mapping.carName}, ${branchId})
          RETURNING id, plate, car_visual_name, model, branch_id
        `;
        
        car = newCar[0];
        console.log(`   ✅ Создана машина: ${car.car_visual_name} (ID: ${car.id})`);
      } else {
        car = cars[0];
        console.log(`   ✅ Найдена машина: ${car.car_visual_name || car.model} (ID: ${car.id})`);
      }

      // 2. Находим устройство
      const devices = await sql`
        SELECT id, device_id, alias, car_id, matched
        FROM starline_devices
        WHERE device_id = ${mapping.deviceId}
        LIMIT 1
      `;

      if (devices.length === 0) {
        console.log(`   ⚠️  Устройство ${mapping.deviceId} не найдено!`);
        continue;
      }

      const device = devices[0];
      console.log(`   ✅ Найдено устройство: ${device.alias} (ID: ${device.id})`);

      // 3. Отвязываем другие устройства от этой машины
      const otherDevices = await sql`
        SELECT id, device_id, alias
        FROM starline_devices
        WHERE car_id = ${car.id}
          AND device_id != ${mapping.deviceId}
      `;

      if (otherDevices.length > 0) {
        console.log(`   ⚠️  Отвязываю ${otherDevices.length} других устройств от этой машины...`);
        
        for (const otherDevice of otherDevices) {
          await sql`
            INSERT INTO starline_match_history (
              starline_device_id, car_id, matched, method,
              starline_alias, car_license_plate, reason, created_by
            ) VALUES (
              ${otherDevice.id}, ${car.id}, FALSE, 'manual_unmatch',
              ${otherDevice.alias}, ${car.plate},
              'Отвязано: правило "одна машина - одно устройство". Правильное: ' || ${mapping.deviceAlias},
              'system_fix'
            )
          `;

          await sql`
            UPDATE starline_devices
            SET car_id = NULL, matched = FALSE, match_confidence = NULL,
                match_method = NULL, match_notes = 'Отвязано: правило "одна машина - одно устройство"',
                updated_at = NOW()
            WHERE id = ${otherDevice.id}
          `;
        }
      }

      // 4. Привязываем правильное устройство
      if (device.car_id !== car.id) {
        console.log(`   🔗 Привязываю устройство к машине...`);
        
        // Записываем отвязку от старой машины (если была)
        if (device.car_id) {
          const oldCars = await sql`
            SELECT plate FROM cars WHERE id = ${device.car_id} LIMIT 1
          `;
          
          if (oldCars.length > 0) {
            await sql`
              INSERT INTO starline_match_history (
                starline_device_id, car_id, matched, method,
                starline_alias, car_license_plate, reason, created_by
              ) VALUES (
                ${device.id}, ${device.car_id}, FALSE, 'manual_unmatch',
                ${device.alias}, ${oldCars[0].plate},
                'Отвязано: правильное сопоставление - ' || ${mapping.carName} || ' (' || ${mapping.plate} || ')',
                'system_fix'
              )
            `;
          }
        }

        await sql`
          UPDATE starline_devices
          SET 
            car_id = ${car.id},
            matched = TRUE,
            match_confidence = 1.00,
            match_method = 'manual',
            match_notes = 'Правильное сопоставление: ' || ${mapping.carName} || ' (' || ${mapping.plate} || ')',
            updated_at = NOW()
          WHERE id = ${device.id}
        `;

        await sql`
          INSERT INTO starline_match_history (
            starline_device_id, car_id, matched, confidence, method,
            starline_alias, car_license_plate, reason, created_by
          ) VALUES (
            ${device.id}, ${car.id}, TRUE, 1.00, 'manual',
            ${device.alias}, ${car.plate},
            'Правильное сопоставление: ' || ${mapping.carName} || ' (' || ${mapping.plate} || ')',
            'system_fix'
          )
        `;

        console.log(`   ✅ Устройство успешно привязано!`);
      } else {
        console.log(`   ✅ Устройство уже правильно привязано`);
      }
    }

    // ШАГ 3: Проверка результатов
    console.log('\n' + '═'.repeat(80));
    console.log('\n✅ ПРОВЕРКА РЕЗУЛЬТАТОВ:\n');

    for (const mapping of correctMappings) {
      const cars = await sql`
        SELECT id, plate, car_visual_name, model
        FROM cars
        WHERE UPPER(REPLACE(plate, ' ', '')) = UPPER(REPLACE(${mapping.plate}, ' ', ''))
        LIMIT 1
      `;

      if (cars.length > 0) {
        const car = cars[0];
        const devices = await sql`
          SELECT id, device_id, alias, matched, match_confidence, match_method
          FROM starline_devices
          WHERE car_id = ${car.id}
        `;

        console.log(`\n📋 ${mapping.carName} (${mapping.plate}):`);
        if (devices.length === 0) {
          console.log(`   ⚠️  Нет устройств`);
        } else if (devices.length === 1) {
          const dev = devices[0];
          if (dev.device_id === mapping.deviceId) {
            console.log(`   ✅ Правильно: ${dev.alias} (${dev.device_id})`);
            console.log(`      Уверенность: ${dev.match_confidence ? (dev.match_confidence * 100).toFixed(0) + '%' : 'N/A'}`);
            console.log(`      Метод: ${dev.match_method || 'N/A'}`);
          } else {
            console.log(`   ❌ Неправильно: ${dev.alias} (${dev.device_id})`);
            console.log(`      Ожидалось: ${mapping.deviceId}`);
          }
        } else {
          console.log(`   ⚠️  Найдено ${devices.length} устройств:`);
          devices.forEach(dev => {
            const status = dev.device_id === mapping.deviceId ? '✅' : '❌';
            console.log(`      ${status} ${dev.alias} (${dev.device_id})`);
          });
        }
      } else {
        console.log(`\n📋 ${mapping.carName} (${mapping.plate}):`);
        console.log(`   ⚠️  Машина не найдена`);
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('✅ Исправление завершено!');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

fixDeviceMatching();

