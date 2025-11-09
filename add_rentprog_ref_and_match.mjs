import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function addRentprogRefAndMatch() {
  try {
    console.log('🔍 Добавление RentProg ID и сопоставление трекера...\n');

    const rentprogId = '63947';
    const plate = 'RR635WR';
    const trackerDeviceId = 864326067039309;

    // Ищем машину по номеру (разные варианты формата)
    const cars = await sql`
      SELECT 
        c.id,
        c.plate,
        c.car_visual_name,
        c.model,
        c.branch_id
      FROM cars c
      WHERE UPPER(REPLACE(c.plate, ' ', '')) = UPPER(REPLACE(${plate}, ' ', ''))
         OR UPPER(REPLACE(c.plate, ' ', '')) LIKE '%635%'
      LIMIT 5
    `;

    if (cars.length === 0) {
      console.log('❌ Машина с номером RR635WR не найдена в БД');
      console.log('\n💡 Машина еще не синхронизирована из RentProg');
      console.log('   После синхронизации можно будет сопоставить трекер');
      console.log('\n📝 Для сопоставления после синхронизации:');
      console.log(`   - RentProg ID: ${rentprogId}`);
      console.log(`   - Номер: ${plate}`);
      console.log(`   - Трекер Device ID: ${trackerDeviceId}`);
      return;
    }

    console.log(`✅ Найдено машин: ${cars.length}\n`);

    // Если найдена одна машина - работаем с ней
    let targetCar = null;
    if (cars.length === 1) {
      targetCar = cars[0];
    } else {
      // Если несколько - выбираем по точному совпадению номера
      targetCar = cars.find(c => 
        c.plate?.toUpperCase().replace(/\s+/g, '') === plate.toUpperCase().replace(/\s+/g, '')
      ) || cars[0];
    }

    console.log(`📋 Работаем с машиной:`);
    console.log(`   ID: ${targetCar.id}`);
    console.log(`   Название: ${targetCar.car_visual_name || ''} ${targetCar.model}`);
    console.log(`   Номер: ${targetCar.plate}`);
    console.log('');

    // Проверяем, есть ли уже external_ref для RentProg
    const existingRef = await sql`
      SELECT id, external_id
      FROM external_refs
      WHERE entity_id = ${targetCar.id}
        AND entity_type = 'car'
        AND system = 'rentprog'
    `;

    if (existingRef.length > 0) {
      console.log(`ℹ️  У машины уже есть RentProg ID: ${existingRef[0].external_id}`);
      if (existingRef[0].external_id !== rentprogId) {
        console.log(`⚠️  RentProg ID отличается! Текущий: ${existingRef[0].external_id}, новый: ${rentprogId}`);
        console.log('   Обновляем...');
        await sql`
          UPDATE external_refs
          SET external_id = ${rentprogId}
          WHERE id = ${existingRef[0].id}
        `;
        console.log('✅ RentProg ID обновлен');
      }
    } else {
      console.log('💾 Добавляем RentProg ID...');
      await sql`
        INSERT INTO external_refs (
          entity_type,
          entity_id,
          system,
          external_id
        ) VALUES (
          'car',
          ${targetCar.id},
          'rentprog',
          ${rentprogId}
        )
        ON CONFLICT (entity_type, entity_id, system, external_id) DO NOTHING
      `;
      console.log('✅ RentProg ID добавлен');
    }
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
    console.log(`📡 Трекер:`);
    console.log(`   Alias: ${trackerData.alias}`);
    console.log(`   Device ID: ${trackerData.device_id}`);
    console.log(`   Статус: ${trackerData.matched ? 'Сопоставлен' : 'Не сопоставлен'}`);
    if (trackerData.car_id) {
      console.log(`   Текущая машина ID: ${trackerData.car_id}`);
    }
    console.log('');

    // Сопоставляем
    if (trackerData.matched && trackerData.car_id === targetCar.id) {
      console.log('✅ Трекер уже сопоставлен с этой машиной!');
      return;
    }

    console.log('💾 Сопоставляем трекер с машиной...\n');

    await sql`
      UPDATE starline_devices
      SET 
        car_id = ${targetCar.id},
        matched = TRUE,
        match_confidence = 1.00,
        match_method = 'manual_rentprog_id',
        match_notes = 'Сопоставлено вручную по RentProg ID ' || ${rentprogId} || ', номер: ' || ${targetCar.plate}
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
        ${targetCar.plate},
        ${targetCar.car_visual_name || ''},
        ${targetCar.model},
        'Сопоставлено вручную по RentProg ID ' || ${rentprogId},
        'manual'
      )
    `;

    console.log('✅ Сопоставление успешно выполнено!');
    console.log(`   ${trackerData.alias} → ${targetCar.car_visual_name || ''} ${targetCar.model} (${targetCar.plate})`);
    console.log(`   RentProg ID: ${rentprogId}`);

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Запускаем
addRentprogRefAndMatch();

