import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function syncAndMatchKiaSoul() {
  try {
    const rentprogId = '65470';
    const trackerDeviceId = 869573077446165;
    const maxAttempts = 15;
    const delayMs = 2000;

    // Mapping филиалов на company_id
    const companies = [
      { name: 'tbilisi', id: 9247 },
      { name: 'batumi', id: 9248 },
      { name: 'kutaisi', id: 9506 },
      { name: 'service-center', id: 11163 }
    ];

    console.log(`🔍 Синхронизация Kia Soul из RentProg (ID: ${rentprogId})...\n`);

    // Создаем события для синхронизации
    console.log('📝 Создание событий в таблице events...\n');
    for (const company of companies) {
      try {
        const result = await sql`
          INSERT INTO events (
            company_id, 
            type, 
            event_name,
            entity_type,
            operation,
            rentprog_id, 
            ok, 
            processed
          )
          VALUES (
            ${company.id}, 
            'car.update', 
            'car.update',
            'car',
            'update',
            ${rentprogId}, 
            TRUE, 
            FALSE
          )
          ON CONFLICT (company_id, type, rentprog_id) DO NOTHING
          RETURNING id
        `;

        if (result.length > 0) {
          console.log(`   ✅ Событие создано для ${company.name} (event_id: ${result[0].id})`);
        } else {
          console.log(`   ℹ️  Событие уже существует для ${company.name}`);
        }
      } catch (error) {
        console.error(`   ❌ Ошибка для ${company.name}:`, error.message);
      }
    }

    console.log('\n⏳ Ожидание синхронизации машины...\n');
    console.log('💡 Upsert Processor обработает события в течение 5 минут\n');

    // Ждем появления машины в БД
    let carId = null;
    let targetCar = null;

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
        targetCar = car[0];
        carId = targetCar.id;
        console.log(`\n✅ Машина найдена в БД!`);
        console.log(`   ID: ${targetCar.id}`);
        console.log(`   Название: ${targetCar.car_visual_name || ''} ${targetCar.model}`);
        console.log(`   Номер: ${targetCar.plate || 'не указан'}`);
        break;
      }

      if (attempt < maxAttempts) {
        console.log(`   Машина не найдена, жду ${delayMs/1000} сек...\n`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    if (!targetCar) {
      console.log(`\n❌ Машина не найдена после ${maxAttempts} попыток`);
      console.log('\n💡 Возможные причины:');
      console.log('   1. Upsert Processor еще не обработал события');
      console.log('   2. Машина не существует в RentProg с таким ID');
      console.log('   3. Нет доступа к RentProg API');
      console.log('\n📋 Попробуйте запустить скрипт снова через несколько минут');
      return;
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
      LIMIT 1
    `;

    if (tracker.length === 0) {
      console.log('❌ Трекер не найден');
      console.log(`   Искали Device ID: ${trackerDeviceId}`);
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

    // Проверяем, не сопоставлен ли уже
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
        '101',
        'Kia Soul',
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
    console.log(`   Device ID: ${trackerDeviceId}`);

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Запускаем
syncAndMatchKiaSoul();

