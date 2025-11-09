import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function syncViaJarvis() {
  try {
    const rentprogId = '63947';
    const trackerDeviceId = 864326067039309;
    const branches = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];

    console.log(`🔍 Синхронизация машины через Jarvis API (RentProg ID: ${rentprogId})...\n`);

    // Пробуем синхронизировать через все филиалы
    let carId = null;
    let foundBranch = null;

    for (const branch of branches) {
      console.log(`   Пробую филиал: ${branch}...`);
      
      try {
        const response = await fetch('http://46.224.17.15:3000/process-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            branch: branch,
            type: 'car.update',
            ext_id: rentprogId
          })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.ok && result.entityId) {
            carId = result.entityId;
            foundBranch = branch;
            console.log(`   ✅ Машина синхронизирована из филиала: ${branch}`);
            console.log(`   Car ID: ${carId}`);
            break;
          }
        } else {
          const errorText = await response.text();
          console.log(`   ❌ Ошибка ${response.status}: ${errorText.substring(0, 100)}`);
        }
      } catch (error) {
        console.log(`   ❌ Ошибка: ${error.message}`);
      }
    }

    if (!carId) {
      console.log('\n❌ Не удалось синхронизировать машину ни из одного филиала');
      console.log('💡 Возможные причины:');
      console.log('   1. Машина не существует в RentProg');
      console.log('   2. Jarvis API недоступен');
      console.log('   3. Нет доступа к RentProg API');
      return;
    }

    // Ждем немного для завершения транзакции
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Ищем машину в БД
    const car = await sql`
      SELECT 
        c.id,
        c.plate,
        c.car_visual_name,
        c.model,
        c.branch_id
      FROM cars c
      WHERE c.id = ${carId}
      LIMIT 1
    `;

    if (car.length === 0) {
      console.log('❌ Машина не найдена в БД после синхронизации');
      return;
    }

    const targetCar = car[0];
    console.log(`\n✅ Машина найдена в БД:`);
    console.log(`   ID: ${targetCar.id}`);
    console.log(`   Название: ${targetCar.car_visual_name || ''} ${targetCar.model}`);
    console.log(`   Номер: ${targetCar.plate}`);
    console.log(`   Филиал: ${foundBranch}`);
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
        match_method = 'manual_rentprog_sync',
        match_notes = 'Сопоставлено после синхронизации из RentProg ID ' || ${rentprogId} || ', номер: ' || ${targetCar.plate || 'не указан'}
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
        'manual_rentprog_sync',
        ${trackerData.alias},
        '635',
        'Jeep Renegade',
        ${targetCar.plate || 'не указан'},
        ${targetCar.car_visual_name || ''},
        ${targetCar.model || ''},
        'Сопоставлено после синхронизации из RentProg ID ' || ${rentprogId},
        'manual'
      )
    `;

    console.log('✅ Сопоставление успешно выполнено!');
    console.log(`   ${trackerData.alias} → ${targetCar.car_visual_name || ''} ${targetCar.model} (${targetCar.plate || 'не указан'})`);
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
syncViaJarvis();

