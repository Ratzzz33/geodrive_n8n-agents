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

    for (const mapping of correctMappings) {
      console.log(`\n📋 Обработка: ${mapping.carName} (${mapping.plate})`);
      console.log(`   Устройство: ${mapping.deviceAlias} (${mapping.deviceId})`);

      // 1. Находим машину по номеру
      const cars = await sql`
        SELECT id, plate, car_visual_name, model, branch_id
        FROM cars
        WHERE UPPER(REPLACE(plate, ' ', '')) = UPPER(REPLACE(${mapping.plate}, ' ', ''))
        LIMIT 1
      `;

      if (cars.length === 0) {
        console.log(`   ⚠️  Машина с номером ${mapping.plate} не найдена!`);
        continue;
      }

      const car = cars[0];
      console.log(`   ✅ Найдена машина: ${car.car_visual_name || car.model} (ID: ${car.id})`);

      // 2. Находим устройство
      const devices = await sql`
        SELECT id, device_id, alias, car_id, matched, match_confidence, match_method
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

      // 3. Проверяем текущее сопоставление
      if (device.car_id && device.car_id === car.id) {
        console.log(`   ✅ Устройство уже правильно сопоставлено с этой машиной`);
      } else {
        // 4. Отвязываем устройство от старой машины (если было)
        if (device.car_id) {
          const oldCars = await sql`
            SELECT plate, car_visual_name, model
            FROM cars
            WHERE id = ${device.car_id}
            LIMIT 1
          `;
          
          if (oldCars.length > 0) {
            const oldCar = oldCars[0];
            console.log(`   ⚠️  Устройство было привязано к другой машине: ${oldCar.car_visual_name || oldCar.model} (${oldCar.plate})`);
            
            // Записываем в историю отвязку
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
                ${device.id},
                ${device.car_id},
                FALSE,
                'manual_unmatch',
                ${device.alias},
                ${oldCar.plate},
                'Отвязано: правильное сопоставление - ' || ${mapping.carName} || ' (' || ${mapping.plate} || ')',
                'system_fix'
              )
            `;
          }
        }

        // 5. Отвязываем все другие устройства от этой машины
        const otherDevices = await sql`
          SELECT id, device_id, alias
          FROM starline_devices
          WHERE car_id = ${car.id}
            AND device_id != ${mapping.deviceId}
        `;

        if (otherDevices.length > 0) {
          console.log(`   ⚠️  Найдено других устройств на этой машине: ${otherDevices.length}`);
          
          for (const otherDevice of otherDevices) {
            console.log(`      - Отвязываю: ${otherDevice.alias} (${otherDevice.device_id})`);
            
            // Записываем в историю отвязку
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
                ${otherDevice.id},
                ${car.id},
                FALSE,
                'manual_unmatch',
                ${otherDevice.alias},
                ${car.plate},
                'Отвязано: правило "одна машина - одно устройство". Правильное устройство: ' || ${mapping.deviceAlias} || ' (' || ${mapping.deviceId} || ')',
                'system_fix'
              )
            `;

            // Отвязываем устройство
            await sql`
              UPDATE starline_devices
              SET 
                car_id = NULL,
                matched = FALSE,
                match_confidence = NULL,
                match_method = NULL,
                match_notes = 'Отвязано: правило "одна машина - одно устройство"',
                updated_at = NOW()
              WHERE id = ${otherDevice.id}
            `;
          }
        }

        // 6. Привязываем правильное устройство к машине
        console.log(`   🔗 Привязываю устройство к машине...`);
        
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

        // 7. Записываем в историю новое сопоставление
        await sql`
          INSERT INTO starline_match_history (
            starline_device_id,
            car_id,
            matched,
            confidence,
            method,
            starline_alias,
            car_license_plate,
            reason,
            created_by
          ) VALUES (
            ${device.id},
            ${car.id},
            TRUE,
            1.00,
            'manual',
            ${device.alias},
            ${car.plate},
            'Правильное сопоставление: ' || ${mapping.carName} || ' (' || ${mapping.plate} || ')',
            'system_fix'
          )
        `;

        console.log(`   ✅ Устройство успешно привязано к машине!`);
      }
    }

    // 8. Проверяем результат
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
          } else {
            console.log(`   ❌ Неправильно: ${dev.alias} (${dev.device_id})`);
          }
        } else {
          console.log(`   ⚠️  Найдено ${devices.length} устройств:`);
          devices.forEach(dev => {
            const status = dev.device_id === mapping.deviceId ? '✅' : '❌';
            console.log(`      ${status} ${dev.alias} (${dev.device_id})`);
          });
        }
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

