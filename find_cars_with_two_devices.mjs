import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function findCarsWithTwoDevices() {
  try {
    console.log('🔍 Поиск машин с двумя устройствами Starline\n');
    console.log('═'.repeat(80));

    // Находим машины с двумя устройствами
    const carsWithTwoDevices = await sql`
      SELECT 
        c.id as car_id,
        c.plate,
        c.car_visual_name,
        c.model,
        b.code as branch_code,
        b.name as branch_name,
        COUNT(sd.id) as device_count,
        array_agg(sd.id ORDER BY sd.id) as device_ids,
        array_agg(sd.device_id ORDER BY sd.id) as device_imeis,
        array_agg(sd.alias ORDER BY sd.id) as aliases
      FROM cars c
      JOIN starline_devices sd ON sd.car_id = c.id
      LEFT JOIN branches b ON b.id = c.branch_id
      WHERE sd.matched = TRUE
      GROUP BY c.id, c.plate, c.car_visual_name, c.model, b.code, b.name
      HAVING COUNT(sd.id) = 2
      ORDER BY c.plate
    `;

    if (carsWithTwoDevices.length === 0) {
      console.log('❌ Не найдено машин с двумя устройствами Starline\n');
      return;
    }

    console.log(`✅ Найдено машин с двумя устройствами: ${carsWithTwoDevices.length}\n`);

    for (const car of carsWithTwoDevices) {
      console.log('═'.repeat(80));
      console.log(`\n📋 Машина: ${car.car_visual_name || car.model || 'N/A'}`);
      console.log(`   ├─ Госномер: ${car.plate || 'N/A'}`);
      console.log(`   ├─ Модель: ${car.model || 'N/A'}`);
      console.log(`   ├─ Филиал: ${car.branch_name || 'N/A'} (${car.branch_code || 'N/A'})`);
      console.log(`   ├─ Car ID: ${car.car_id}`);
      console.log(`   └─ Количество устройств: ${car.device_count}`);

      // Получаем детали обоих устройств
      const devices = await sql`
        SELECT 
          sd.id,
          sd.device_id,
          sd.alias,
          sd.extracted_model,
          sd.extracted_digits,
          sd.matched,
          sd.match_confidence,
          sd.match_method,
          sd.match_notes,
          sd.imei,
          sd.phone,
          sd.sn,
          sd.device_type,
          sd.fw_version,
          sd.active,
          sd.first_seen,
          sd.last_seen,
          sd.previous_aliases,
          sd.alias_changed_at
        FROM starline_devices sd
        WHERE sd.car_id = ${car.car_id}
        ORDER BY sd.id
      `;

      devices.forEach((device, index) => {
        console.log(`\n   📡 Устройство ${index + 1}:`);
        console.log(`   ├─ ID: ${device.id}`);
        console.log(`   ├─ Device ID (IMEI): ${device.device_id}`);
        console.log(`   ├─ Alias: ${device.alias}`);
        console.log(`   ├─ Извлеченная модель: ${device.extracted_model || 'N/A'}`);
        console.log(`   ├─ Извлеченные цифры: ${device.extracted_digits || 'N/A'}`);
        console.log(`   ├─ Сопоставлено: ${device.matched ? '✅ Да' : '❌ Нет'}`);
        if (device.match_confidence) {
          console.log(`   ├─ Уверенность: ${(device.match_confidence * 100).toFixed(0)}%`);
        }
        if (device.match_method) {
          console.log(`   ├─ Метод сопоставления: ${device.match_method}`);
        }
        if (device.match_notes) {
          console.log(`   ├─ Заметки: ${device.match_notes}`);
        }
        console.log(`   ├─ IMEI: ${device.imei || 'N/A'}`);
        console.log(`   ├─ Телефон SIM: ${device.phone || 'N/A'}`);
        console.log(`   ├─ Серийный номер: ${device.sn || 'N/A'}`);
        console.log(`   ├─ Тип устройства: ${device.device_type || 'N/A'}`);
        console.log(`   ├─ Версия прошивки: ${device.fw_version || 'N/A'}`);
        console.log(`   ├─ Активно: ${device.active ? '✅ Да' : '❌ Нет'}`);
        console.log(`   ├─ Первое обнаружение: ${device.first_seen}`);
        console.log(`   ├─ Последнее обнаружение: ${device.last_seen}`);
        if (device.previous_aliases && device.previous_aliases.length > 0) {
          console.log(`   ├─ Предыдущие названия: ${device.previous_aliases.join(', ')}`);
        }
        if (device.alias_changed_at) {
          console.log(`   └─ Изменено: ${device.alias_changed_at}`);
        } else {
          console.log(`   └─ Изменено: никогда`);
        }
      });

      // Проверяем GPS данные для этой машины
      const gpsData = await sql`
        SELECT 
          gt.starline_device_id,
          gt.starline_alias,
          gt.current_lat,
          gt.current_lng,
          gt.status,
          gt.is_moving,
          gt.last_sync
        FROM gps_tracking gt
        WHERE gt.car_id = ${car.car_id}
        LIMIT 1
      `;

      if (gpsData.length > 0) {
        const gps = gpsData[0];
        console.log(`\n   📍 GPS данные:`);
        console.log(`   ├─ Устройство: ${gps.starline_alias || gps.starline_device_id || 'N/A'}`);
        console.log(`   ├─ Координаты: ${gps.current_lat || 'N/A'}, ${gps.current_lng || 'N/A'}`);
        console.log(`   ├─ Статус: ${gps.status || 'N/A'}`);
        console.log(`   ├─ Движется: ${gps.is_moving ? '✅ Да' : '❌ Нет'}`);
        console.log(`   └─ Последняя синхронизация: ${gps.last_sync || 'N/A'}`);
      }
    }

    // Сводная статистика
    console.log('\n' + '═'.repeat(80));
    console.log('\n📊 СВОДНАЯ СТАТИСТИКА:\n');
    
    const stats = await sql`
      SELECT 
        COUNT(DISTINCT c.id) as total_cars,
        COUNT(DISTINCT CASE WHEN device_count = 2 THEN c.id END) as cars_with_2_devices,
        COUNT(DISTINCT CASE WHEN device_count = 1 THEN c.id END) as cars_with_1_device,
        COUNT(DISTINCT CASE WHEN device_count > 2 THEN c.id END) as cars_with_more_devices,
        COUNT(DISTINCT CASE WHEN device_count = 0 THEN c.id END) as cars_without_devices
      FROM (
        SELECT 
          c.id,
          COUNT(sd.id) as device_count
        FROM cars c
        LEFT JOIN starline_devices sd ON sd.car_id = c.id AND sd.matched = TRUE
        GROUP BY c.id
      ) device_counts
      JOIN cars c ON c.id = device_counts.id
    `;

    if (stats.length > 0) {
      const s = stats[0];
      console.log(`   ├─ Всего машин: ${s.total_cars || 0}`);
      console.log(`   ├─ С 1 устройством: ${s.cars_with_1_device || 0}`);
      console.log(`   ├─ С 2 устройствами: ${s.cars_with_2_devices || 0}`);
      console.log(`   ├─ С 3+ устройствами: ${s.cars_with_more_devices || 0}`);
      console.log(`   └─ Без устройств: ${s.cars_without_devices || 0}`);
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

findCarsWithTwoDevices();

