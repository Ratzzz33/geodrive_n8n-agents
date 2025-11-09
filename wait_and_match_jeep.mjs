import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function waitAndMatch() {
  try {
    const rentprogId = '63947';
    const trackerDeviceId = 864326067039309;
    const maxAttempts = 10;
    const delayMs = 3000;

    console.log(`🔍 Ожидание появления машины в БД (RentProg ID: ${rentprogId})...\n`);
    console.log('💡 Убедитесь, что машина синхронизирована из RentProg через n8n workflow или Jarvis API\n');

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`Попытка ${attempt}/${maxAttempts}...`);

      // Ищем машину по RentProg ID
      const car = await sql`
        SELECT 
          c.id,
          c.plate,
          c.car_visual_name,
          c.model,
          c.branch_id
        FROM cars c
        INNER JOIN external_refs er ON er.entity_id = c.id 
          AND er.entity_type = 'car'
          AND er.system = 'rentprog'
          AND er.external_id = ${rentprogId}
        LIMIT 1
      `;

      if (car.length > 0) {
        const targetCar = car[0];
        console.log(`\n✅ Машина найдена в БД!`);
        console.log(`   ID: ${targetCar.id}`);
        console.log(`   Название: ${targetCar.car_visual_name || ''} ${targetCar.model}`);
        console.log(`   Номер: ${targetCar.plate || 'не указан'}`);
        console.log('');

        // Ищем трекер
        const tracker = await sql`
          SELECT 
            id,
            device_id,
            alias,
            matched,
            car_id
          FROM starline_devices
          WHERE device_id = ${trackerDeviceId}
             OR alias = 'Jeep Renegade RR635WR'
          LIMIT 1
        `;

        if (tracker.length === 0) {
          console.log('❌ Трекер не найден');
          return;
        }

        const trackerData = tracker[0];
        
        // Проверяем, не сопоставлен ли уже
        if (trackerData.matched && trackerData.car_id === targetCar.id) {
          console.log('✅ Трекер уже сопоставлен с этой машиной!');
          return;
        }

        console.log(`📡 Трекер: ${trackerData.alias}`);
        console.log('💾 Сопоставляем...\n');

        await sql`
          UPDATE starline_devices
          SET 
            car_id = ${targetCar.id},
            matched = TRUE,
            match_confidence = 1.00,
            match_method = 'manual_rentprog_id',
            match_notes = 'Сопоставлено вручную по RentProg ID ' || ${rentprogId} || ', номер: ' || COALESCE(${targetCar.plate}, 'не указан')
          WHERE id = ${trackerData.id}
        `;

        // Записываем в историю
        await sql`
          INSERT INTO starline_match_history (
            starline_device_id,
            car_id,
            matched,
            confidence,
            method,
            starline_alias,
            starline_digits,
            starline_model,
            car_license_plate,
            car_brand,
            car_model,
            reason,
            created_by
          ) VALUES (
            ${trackerData.id},
            ${targetCar.id},
            TRUE,
            1.00,
            'manual_rentprog_id',
            ${trackerData.alias},
            '635',
            'Jeep Renegade',
            ${targetCar.plate || 'не указан'},
            ${targetCar.car_visual_name || ''},
            ${targetCar.model || ''},
            'Сопоставлено вручную по RentProg ID ' || ${rentprogId},
            'manual'
          )
        `;

        console.log('✅ Сопоставление успешно выполнено!');
        console.log(`   ${trackerData.alias} → ${targetCar.car_visual_name || ''} ${targetCar.model} (${targetCar.plate || 'не указан'})`);
        console.log(`   RentProg ID: ${rentprogId}`);
        return;
      }

      if (attempt < maxAttempts) {
        console.log(`   Машина не найдена, жду ${delayMs/1000} сек...\n`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    console.log(`\n❌ Машина не найдена после ${maxAttempts} попыток`);
    console.log('\n💡 Инструкция:');
    console.log('   1. Убедитесь, что машина синхронизирована из RentProg');
    console.log('   2. Можно запустить n8n workflow "RentProg Upsert Processor"');
    console.log('   3. Или вызвать Jarvis API: POST /process-event с type="car.update", ext_id="63947"');
    console.log('   4. Затем запустите этот скрипт снова');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Запускаем
waitAndMatch();

