import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function matchJeepRenegade() {
  try {
    console.log('🔍 Поиск машины Jeep Renegade по RentProg ID 63947...\n');

    // Ищем машину по RentProg ID через external_refs
    const carResult = await sql`
      SELECT 
        c.id,
        c.plate,
        c.car_visual_name,
        c.model,
        c.branch_id,
        er.external_id as rentprog_id
      FROM cars c
      INNER JOIN external_refs er ON er.entity_id = c.id 
        AND er.entity_type = 'car'
        AND er.system = 'rentprog'
        AND er.external_id = '63947'
      LIMIT 1
    `;

    if (carResult.length === 0) {
      console.log('❌ Машина с RentProg ID 63947 не найдена в БД');
      console.log('💡 Возможно, нужно сначала синхронизировать данные из RentProg');
      return;
    }

    const car = carResult[0];
    console.log(`✅ Найдена машина:`);
    console.log(`   ID: ${car.id}`);
    console.log(`   Название: ${car.car_visual_name || ''} ${car.model}`);
    console.log(`   Номер: ${car.plate}`);
    console.log(`   RentProg ID: ${car.rentprog_id}`);
    console.log('');

    // Проверяем, есть ли у машины уже трекер
    const existingTracker = await sql`
      SELECT 
        id,
        device_id,
        alias,
        matched
      FROM starline_devices
      WHERE car_id = ${car.id}
        AND matched = TRUE
    `;

    if (existingTracker.length > 0) {
      console.log('⚠️  У этой машины уже есть трекер:');
      existingTracker.forEach(tracker => {
        console.log(`   ${tracker.alias} (Device ID: ${tracker.device_id})`);
      });
      console.log('');
    }

    // Ищем трекер Jeep Renegade RR635WR
    const trackerResult = await sql`
      SELECT 
        id,
        device_id,
        alias,
        extracted_model,
        extracted_digits,
        matched,
        car_id
      FROM starline_devices
      WHERE alias = 'Jeep Renegade RR635WR'
         OR device_id = 864326067039309
      LIMIT 1
    `;

    if (trackerResult.length === 0) {
      console.log('❌ Трекер "Jeep Renegade RR635WR" не найден');
      return;
    }

    const tracker = trackerResult[0];
    console.log(`✅ Найден трекер:`);
    console.log(`   ID: ${tracker.id}`);
    console.log(`   Alias: ${tracker.alias}`);
    console.log(`   Device ID: ${tracker.device_id}`);
    console.log(`   Текущий статус: ${tracker.matched ? 'Сопоставлен' : 'Не сопоставлен'}`);
    if (tracker.car_id) {
      console.log(`   Текущая машина ID: ${tracker.car_id}`);
    }
    console.log('');

    // Проверяем совпадение номера
    const trackerPlate = 'RR635WR';
    const carPlate = car.plate?.toUpperCase().replace(/\s+/g, '');
    const trackerPlateNormalized = trackerPlate.toUpperCase().replace(/\s+/g, '');

    if (carPlate === trackerPlateNormalized) {
      console.log(`✅ Номера совпадают: ${carPlate} = ${trackerPlateNormalized}`);
    } else {
      console.log(`⚠️  Номера не совпадают:`);
      console.log(`   Машина: ${carPlate}`);
      console.log(`   Трекер: ${trackerPlateNormalized}`);
    }
    console.log('');

    // Сопоставляем
    if (tracker.matched && tracker.car_id === car.id) {
      console.log('✅ Трекер уже сопоставлен с этой машиной!');
      return;
    }

    if (tracker.matched && tracker.car_id !== car.id) {
      console.log('⚠️  Трекер уже сопоставлен с другой машиной!');
      console.log('   Продолжить сопоставление? (в скрипте нужно раскомментировать)');
      // Можно добавить логику для пересопоставления, но это требует подтверждения
      return;
    }

    console.log('💾 Сопоставление трекера с машиной...\n');

    // Обновляем сопоставление
    await sql`
      UPDATE starline_devices
      SET 
        car_id = ${car.id},
        matched = TRUE,
        match_confidence = 1.00,
        match_method = 'manual_rentprog_id',
        match_notes = 'Сопоставлено вручную по RentProg ID 63947, номер: ' || ${car.plate}
      WHERE id = ${tracker.id}
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
        ${tracker.id},
        ${car.id},
        TRUE,
        1.00,
        'manual_rentprog_id',
        ${tracker.alias},
        ${tracker.extracted_digits},
        ${tracker.extracted_model},
        ${car.plate},
        ${car.car_visual_name || ''},
        ${car.model},
        'Сопоставлено вручную по RentProg ID 63947',
        'manual'
      )
    `;

    console.log('✅ Сопоставление успешно обновлено!');
    console.log(`   ${tracker.alias} → ${car.car_visual_name || ''} ${car.model} (${car.plate})`);
    console.log(`   RentProg ID: ${car.rentprog_id}`);

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Запускаем
matchJeepRenegade();

