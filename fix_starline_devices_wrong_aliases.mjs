import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function fixStarlineDevices() {
  try {
    console.log('🔍 Проверка и исправление неправильных alias/extracted_model в starline_devices\n');
    console.log('━'.repeat(70));

    // 1. Находим проблемную запись для DK700DK
    console.log('\n📋 1. Проверка записи для DK700DK:');
    console.log('━'.repeat(70));

    const dk700dkDevice = await sql`
      SELECT 
        sd.id,
        sd.device_id,
        sd.alias,
        sd.extracted_model,
        sd.extracted_digits,
        sd.car_id,
        sd.matched,
        sd.match_confidence,
        sd.match_method,
        c.plate as car_plate,
        c.model as car_model,
        c.vin as car_vin
      FROM starline_devices sd
      JOIN cars c ON c.id = sd.car_id
      WHERE UPPER(REPLACE(c.plate, ' ', '')) = 'DK700DK'
    `;

    if (dk700dkDevice.length > 0) {
      const device = dk700dkDevice[0];
      console.log('\n✅ Найдена запись для DK700DK:');
      console.log(`   Device ID: ${device.device_id}`);
      console.log(`   Текущий alias: "${device.alias}"`);
      console.log(`   Текущий extracted_model: "${device.extracted_model}"`);
      console.log(`   Car plate: ${device.car_plate}`);
      console.log(`   Car model: ${device.car_model}`);
      console.log(`   Car VIN: ${device.car_vin || 'N/A'}`);

      // Проверяем, содержит ли alias/extracted_model номер другой машины
      const hasWrongPlate = device.alias && device.alias.includes('OC700OC');
      const hasWrongModel = device.extracted_model && device.extracted_model.includes('OC700OC');

      if (hasWrongPlate || hasWrongModel) {
        console.log('\n   ⚠️ ПРОБЛЕМА: alias/extracted_model содержит номер другой машины (OC700OC)');
        
        // Определяем правильный alias (из модели машины + номер)
        const correctAlias = `${device.car_model} ${device.car_plate}`;
        const correctExtractedModel = device.car_model;

        console.log(`\n   🔧 Исправление:`);
        console.log(`      Старый alias: "${device.alias}"`);
        console.log(`      Новый alias: "${correctAlias}"`);
        console.log(`      Старый extracted_model: "${device.extracted_model}"`);
        console.log(`      Новый extracted_model: "${correctExtractedModel}"`);

        // Обновляем запись
        await sql`
          UPDATE starline_devices
          SET 
            alias = ${correctAlias},
            extracted_model = ${correctExtractedModel},
            updated_at = NOW()
          WHERE id = ${device.id}
        `;

        console.log(`\n   ✅ Исправлено!`);
      } else {
        console.log('\n   ✅ Запись корректна, исправление не требуется');
      }
    } else {
      console.log('\n   ❌ Запись для DK700DK не найдена в starline_devices');
    }

    // 2. Проверяем все записи на подобные проблемы
    console.log('\n\n📋 2. Проверка всех записей на неправильные alias/extracted_model:');
    console.log('━'.repeat(70));

    // Получаем все сопоставленные устройства
    const allDevices = await sql`
      SELECT 
        sd.id,
        sd.device_id,
        sd.alias,
        sd.extracted_model,
        sd.extracted_digits,
        sd.car_id,
        c.plate as car_plate,
        c.model as car_model
      FROM starline_devices sd
      JOIN cars c ON c.id = sd.car_id
      WHERE sd.matched = TRUE
        AND c.plate IS NOT NULL
      ORDER BY c.plate
    `;

    console.log(`\n📊 Всего сопоставленных устройств: ${allDevices.length}`);

    const problems = [];

    for (const device of allDevices) {
      const carPlate = device.car_plate.toUpperCase().replace(/\s/g, '');
      
      // Проверяем, содержит ли alias номер другой машины
      if (device.alias) {
        // Извлекаем все возможные номера из alias (формат: 3 буквы + 3 цифры + 2-3 буквы)
        const platePattern = /([A-Z]{2,3}\d{3}[A-Z]{2,3})/gi;
        const matches = device.alias.match(platePattern);
        
        if (matches) {
          for (const match of matches) {
            const foundPlate = match.toUpperCase().replace(/\s/g, '');
            if (foundPlate !== carPlate) {
              problems.push({
                device_id: device.device_id,
                car_plate: device.car_plate,
                car_model: device.car_model,
                alias: device.alias,
                extracted_model: device.extracted_model,
                wrong_plate_in_alias: foundPlate,
                issue: 'alias содержит номер другой машины'
              });
            }
          }
        }
      }

      // Проверяем, содержит ли extracted_model номер другой машины
      if (device.extracted_model) {
        const platePattern = /([A-Z]{2,3}\d{3}[A-Z]{2,3})/gi;
        const matches = device.extracted_model.match(platePattern);
        
        if (matches) {
          for (const match of matches) {
            const foundPlate = match.toUpperCase().replace(/\s/g, '');
            if (foundPlate !== carPlate) {
              problems.push({
                device_id: device.device_id,
                car_plate: device.car_plate,
                car_model: device.car_model,
                alias: device.alias,
                extracted_model: device.extracted_model,
                wrong_plate_in_model: foundPlate,
                issue: 'extracted_model содержит номер другой машины'
              });
            }
          }
        }
      }
    }

    if (problems.length > 0) {
      console.log(`\n⚠️ Найдено проблем: ${problems.length}`);
      console.log('\n📋 Список проблем:');
      console.log('━'.repeat(70));

      for (const problem of problems) {
        console.log(`\n   🔴 Device ID: ${problem.device_id}`);
        console.log(`      Машина: ${problem.car_plate} (${problem.car_model})`);
        console.log(`      Проблема: ${problem.issue}`);
        console.log(`      Текущий alias: "${problem.alias}"`);
        console.log(`      Текущий extracted_model: "${problem.extracted_model}"`);
        if (problem.wrong_plate_in_alias) {
          console.log(`      ❌ Найден чужой номер в alias: ${problem.wrong_plate_in_alias}`);
        }
        if (problem.wrong_plate_in_model) {
          console.log(`      ❌ Найден чужой номер в extracted_model: ${problem.wrong_plate_in_model}`);
        }

        // Исправляем
        const correctAlias = `${problem.car_model} ${problem.car_plate}`;
        const correctExtractedModel = problem.car_model;

        console.log(`\n      🔧 Исправление:`);
        console.log(`         Новый alias: "${correctAlias}"`);
        console.log(`         Новый extracted_model: "${correctExtractedModel}"`);

        await sql`
          UPDATE starline_devices
          SET 
            alias = ${correctAlias},
            extracted_model = ${correctExtractedModel},
            updated_at = NOW()
          WHERE device_id = ${problem.device_id}
        `;

        console.log(`      ✅ Исправлено!`);
      }
    } else {
      console.log('\n✅ Проблем не найдено! Все записи корректны.');
    }

    // 3. Финальная проверка
    console.log('\n\n📋 3. Финальная проверка исправлений:');
    console.log('━'.repeat(70));

    const finalCheck = await sql`
      SELECT 
        sd.device_id,
        sd.alias,
        sd.extracted_model,
        c.plate as car_plate,
        c.model as car_model
      FROM starline_devices sd
      JOIN cars c ON c.id = sd.car_id
      WHERE UPPER(REPLACE(c.plate, ' ', '')) IN ('DK700DK', 'OC700OC')
      ORDER BY c.plate
    `;

    console.log('\n📊 Финальное состояние:');
    for (const device of finalCheck) {
      console.log(`\n   🚗 ${device.car_plate} (${device.car_model}):`);
      console.log(`      Device ID: ${device.device_id}`);
      console.log(`      Alias: "${device.alias}"`);
      console.log(`      Extracted Model: "${device.extracted_model}"`);
    }

    console.log('\n\n✅ Проверка и исправление завершены!\n');

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

fixStarlineDevices();

