import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function findDuplicateDevices() {
  try {
    console.log('🔍 Поиск устройств Starline, привязанных к нескольким машинам\n');
    console.log('═'.repeat(80));

    // 1. Проверяем текущие привязки - устройства с одинаковым device_id, но разными car_id
    console.log('📡 ПРОВЕРКА: Устройства с одинаковым device_id, но разными car_id\n');

    const duplicateDeviceIds = await sql`
      SELECT 
        device_id,
        COUNT(DISTINCT car_id) as car_count,
        COUNT(*) as device_count,
        array_agg(DISTINCT car_id) as car_ids,
        array_agg(id) as device_ids
      FROM starline_devices
      WHERE car_id IS NOT NULL
      GROUP BY device_id
      HAVING COUNT(DISTINCT car_id) > 1
      ORDER BY car_count DESC
    `;

    if (duplicateDeviceIds.length === 0) {
      console.log('✅ Не найдено устройств с одинаковым device_id, привязанных к разным машинам\n');
    } else {
      console.log(`⚠️  Найдено устройств с дубликатами: ${duplicateDeviceIds.length}\n`);
      
      for (const dup of duplicateDeviceIds) {
        console.log(`\n🔴 Device ID: ${dup.device_id}`);
        console.log(`   ├─ Количество машин: ${dup.car_count}`);
        console.log(`   ├─ Количество записей устройств: ${dup.device_count}`);
        console.log(`   └─ Car IDs: ${dup.car_ids.join(', ')}`);

        // Получаем детали каждого устройства
        const devices = await sql`
          SELECT 
            sd.id,
            sd.device_id,
            sd.alias,
            sd.car_id,
            sd.matched,
            sd.match_confidence,
            sd.match_method,
            c.plate,
            c.car_visual_name,
            c.model
          FROM starline_devices sd
          LEFT JOIN cars c ON c.id = sd.car_id
          WHERE sd.device_id = ${dup.device_id}
          ORDER BY sd.id
        `;

        devices.forEach((device, index) => {
          console.log(`\n   Устройство ${index + 1}:`);
          console.log(`   ├─ ID записи: ${device.id}`);
          console.log(`   ├─ Alias: ${device.alias}`);
          console.log(`   ├─ Car ID: ${device.car_id || 'NULL'}`);
          console.log(`   ├─ Машина: ${device.car_visual_name || device.model || 'N/A'} (${device.plate || 'N/A'})`);
          console.log(`   ├─ Сопоставлено: ${device.matched ? 'Да' : 'Нет'}`);
          if (device.match_confidence) {
            console.log(`   ├─ Уверенность: ${(device.match_confidence * 100).toFixed(0)}%`);
          }
          if (device.match_method) {
            console.log(`   └─ Метод: ${device.match_method}`);
          }
        });
      }
    }

    // 2. Проверяем устройства, которые в истории были привязаны к разным машинам
    console.log('\n' + '═'.repeat(80));
    console.log('📜 ПРОВЕРКА: История сопоставлений - устройства с разными машинами\n');

    const historyDuplicates = await sql`
      SELECT 
        mh.starline_device_id,
        sd.device_id,
        sd.alias,
        COUNT(DISTINCT mh.car_id) as different_cars_count,
        array_agg(DISTINCT mh.car_id) as car_ids,
        array_agg(DISTINCT mh.car_license_plate) FILTER (WHERE mh.car_license_plate IS NOT NULL) as plates
      FROM starline_match_history mh
      JOIN starline_devices sd ON sd.id = mh.starline_device_id
      WHERE mh.car_id IS NOT NULL
      GROUP BY mh.starline_device_id, sd.device_id, sd.alias
      HAVING COUNT(DISTINCT mh.car_id) > 1
      ORDER BY different_cars_count DESC
    `;

    if (historyDuplicates.length === 0) {
      console.log('✅ В истории сопоставлений не найдено устройств с разными машинами\n');
    } else {
      console.log(`⚠️  Найдено устройств в истории: ${historyDuplicates.length}\n`);
      
      for (const hist of historyDuplicates) {
        console.log(`\n🔴 Device ID: ${hist.device_id} (${hist.alias})`);
        console.log(`   ├─ Starline Device ID: ${hist.starline_device_id}`);
        console.log(`   ├─ Количество разных машин в истории: ${hist.different_cars_count}`);
        console.log(`   ├─ Car IDs: ${hist.car_ids.join(', ')}`);
        if (hist.plates && hist.plates.length > 0) {
          console.log(`   └─ Номера машин: ${hist.plates.join(', ')}`);

          // Получаем детали истории
          const historyDetails = await sql`
            SELECT 
              mh.id,
              mh.matched,
              mh.confidence,
              mh.method,
              mh.car_license_plate,
              mh.reason,
              mh.created_at,
              c.car_visual_name,
              c.model
            FROM starline_match_history mh
            LEFT JOIN cars c ON c.plate = mh.car_license_plate
            WHERE mh.starline_device_id = ${hist.starline_device_id}
            ORDER BY mh.created_at DESC
            LIMIT 10
          `;

          console.log(`\n   Последние записи в истории:`);
          historyDetails.forEach((h, index) => {
            console.log(`\n   ${index + 1}. ${h.created_at}`);
            console.log(`      ├─ Сопоставлено: ${h.matched ? 'Да' : 'Нет'}`);
            if (h.confidence) {
              console.log(`      ├─ Уверенность: ${(h.confidence * 100).toFixed(0)}%`);
            }
            console.log(`      ├─ Метод: ${h.method || 'N/A'}`);
            console.log(`      ├─ Машина: ${h.car_visual_name || h.model || 'N/A'} (${h.car_license_plate || 'N/A'})`);
            if (h.reason) {
              console.log(`      └─ Причина: ${h.reason}`);
            }
          });
        }
      }
    }

    // 3. Проверяем устройства, которые имеют несколько записей в starline_devices
    console.log('\n' + '═'.repeat(80));
    console.log('🔍 ПРОВЕРКА: Устройства с несколькими записями в starline_devices\n');

    const multipleRecords = await sql`
      SELECT 
        device_id,
        COUNT(*) as record_count,
        COUNT(DISTINCT car_id) as distinct_cars,
        array_agg(id) as ids,
        array_agg(alias) as aliases,
        array_agg(car_id) as car_ids
      FROM starline_devices
      GROUP BY device_id
      HAVING COUNT(*) > 1
      ORDER BY record_count DESC
    `;

    if (multipleRecords.length === 0) {
      console.log('✅ Не найдено устройств с несколькими записями\n');
    } else {
      console.log(`⚠️  Найдено устройств с несколькими записями: ${multipleRecords.length}\n`);
      
      for (const multi of multipleRecords) {
        console.log(`\n🔴 Device ID: ${multi.device_id}`);
        console.log(`   ├─ Количество записей: ${multi.record_count}`);
        console.log(`   ├─ Количество разных машин: ${multi.distinct_cars}`);
        console.log(`   ├─ IDs записей: ${multi.ids.join(', ')}`);
        console.log(`   ├─ Aliases: ${multi.aliases.join(', ')}`);
        console.log(`   └─ Car IDs: ${multi.car_ids.join(', ')}`);

        // Получаем детали всех записей
        const records = await sql`
          SELECT 
            sd.id,
            sd.alias,
            sd.car_id,
            sd.matched,
            sd.match_confidence,
            sd.match_method,
            sd.active,
            sd.last_seen,
            c.plate,
            c.car_visual_name
          FROM starline_devices sd
          LEFT JOIN cars c ON c.id = sd.car_id
          WHERE sd.device_id = ${multi.device_id}
          ORDER BY sd.id
        `;

        records.forEach((record, index) => {
          console.log(`\n   Запись ${index + 1}:`);
          console.log(`   ├─ ID: ${record.id}`);
          console.log(`   ├─ Alias: ${record.alias}`);
          console.log(`   ├─ Car ID: ${record.car_id || 'NULL'}`);
          console.log(`   ├─ Машина: ${record.car_visual_name || 'N/A'} (${record.plate || 'N/A'})`);
          console.log(`   ├─ Сопоставлено: ${record.matched ? 'Да' : 'Нет'}`);
          console.log(`   ├─ Активно: ${record.active ? 'Да' : 'Нет'}`);
          console.log(`   └─ Последнее обнаружение: ${record.last_seen}`);
        });
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('✅ Проверка завершена!');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

findDuplicateDevices();

