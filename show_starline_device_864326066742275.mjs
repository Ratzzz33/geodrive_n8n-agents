import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function showStarlineDevice() {
  try {
    const deviceId = 864326066742275;
    console.log(`🔍 Данные Starline для устройства Device ID (IMEI): ${deviceId}\n`);
    console.log('═'.repeat(80));

    // 1. Данные устройства из starline_devices
    console.log('📡 ДАННЫЕ УСТРОЙСТВА STARLINE ИЗ БД:\n');

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
        sd.alias_changed_at,
        sd.created_at,
        sd.updated_at,
        sd.car_id,
        c.plate,
        c.car_visual_name,
        c.model as car_model,
        b.code as branch_code,
        b.name as branch_name
      FROM starline_devices sd
      LEFT JOIN cars c ON c.id = sd.car_id
      LEFT JOIN branches b ON b.id = c.branch_id
      WHERE sd.device_id = ${deviceId}
      LIMIT 1
    `;

    if (devices.length === 0) {
      console.log(`❌ Устройство с Device ID ${deviceId} не найдено в БД\n`);
      return;
    }

    const device = devices[0];
    console.log(`Устройство:`);
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
      console.log(`   ├─ Изменено: ${device.alias_changed_at}`);
    }
    console.log(`   ├─ Создано: ${device.created_at}`);
    console.log(`   └─ Обновлено: ${device.updated_at}`);

    if (device.car_id) {
      console.log(`\n📋 Связанная машина:`);
      console.log(`   ├─ Car ID: ${device.car_id}`);
      console.log(`   ├─ Госномер: ${device.plate || 'N/A'}`);
      console.log(`   ├─ Название: ${device.car_visual_name || device.car_model || 'N/A'}`);
      console.log(`   ├─ Модель: ${device.car_model || 'N/A'}`);
      console.log(`   ├─ Филиал: ${device.branch_name || 'N/A'} (${device.branch_code || 'N/A'})`);
    } else {
      console.log(`\n⚠️  Устройство не сопоставлено с машиной`);
    }

    // 2. Текущие GPS данные из gps_tracking
    if (device.car_id) {
      console.log('\n' + '═'.repeat(80));
      console.log('📍 ТЕКУЩИЕ GPS ДАННЫЕ:\n');

      const gpsTracking = await sql`
        SELECT 
          gt.starline_device_id,
          gt.starline_alias,
          gt.current_lat,
          gt.current_lng,
          gt.current_sat_qty,
          gt.current_timestamp,
          gt.previous_lat,
          gt.previous_lng,
          gt.previous_sat_qty,
          gt.previous_timestamp,
          gt.status,
          gt.is_moving,
          gt.distance_moved,
          gt.speed,
          gt.google_maps_link,
          gt.gps_level,
          gt.gsm_level,
          gt.ignition_on,
          gt.engine_running,
          gt.parking_brake,
          gt.battery_voltage,
          gt.last_activity,
          gt.last_sync,
          gt.created_at,
          gt.updated_at
        FROM gps_tracking gt
        WHERE gt.car_id = ${device.car_id}
        LIMIT 1
      `;

      if (gpsTracking.length === 0) {
        console.log('❌ GPS данные не найдены для этой машины\n');
      } else {
        const gps = gpsTracking[0];
        console.log(`Текущее положение:`);
        console.log(`   ├─ Широта: ${gps.current_lat || 'N/A'}`);
        console.log(`   ├─ Долгота: ${gps.current_lng || 'N/A'}`);
        console.log(`   ├─ Спутники: ${gps.current_sat_qty || 'N/A'}`);
        console.log(`   ├─ Время: ${gps.current_timestamp || 'N/A'}`);
        if (gps.google_maps_link) {
          console.log(`   └─ Карта: ${gps.google_maps_link}`);
        }
        console.log(`\nПредыдущее положение:`);
        console.log(`   ├─ Широта: ${gps.previous_lat || 'N/A'}`);
        console.log(`   ├─ Долгота: ${gps.previous_lng || 'N/A'}`);
        console.log(`   ├─ Спутники: ${gps.previous_sat_qty || 'N/A'}`);
        console.log(`   └─ Время: ${gps.previous_timestamp || 'N/A'}`);
        console.log(`\nСтатус и движение:`);
        console.log(`   ├─ Статус: ${gps.status || 'N/A'}`);
        console.log(`   ├─ Движется: ${gps.is_moving ? '✅ Да' : '❌ Нет'}`);
        console.log(`   ├─ Дистанция: ${gps.distance_moved ? gps.distance_moved + ' м' : 'N/A'}`);
        console.log(`   └─ Скорость: ${gps.speed ? gps.speed + ' км/ч' : 'N/A'}`);
        console.log(`\nСостояние автомобиля:`);
        console.log(`   ├─ Зажигание: ${gps.ignition_on ? '✅ Включено' : '❌ Выключено'}`);
        console.log(`   ├─ Двигатель: ${gps.engine_running ? '✅ Работает' : '❌ Не работает'}`);
        console.log(`   ├─ Ручной тормоз: ${gps.parking_brake ? '✅ Включен' : '❌ Выключен'}`);
        console.log(`   └─ Напряжение АКБ: ${gps.battery_voltage ? gps.battery_voltage + ' В' : 'N/A'}`);
        console.log(`\nСигналы:`);
        console.log(`   ├─ GPS уровень: ${gps.gps_level || 'N/A'}`);
        console.log(`   ├─ GSM уровень: ${gps.gsm_level || 'N/A'}`);
        console.log(`   ├─ Последняя активность: ${gps.last_activity || 'N/A'}`);
        console.log(`   └─ Последняя синхронизация: ${gps.last_sync || 'N/A'}`);
      }

      // 3. История координат из entity_timeline
      console.log('\n' + '═'.repeat(80));
      console.log('📜 10 ПОСЛЕДНИХ КООРДИНАТ (из entity_timeline):\n');

      const gpsHistory = await sql`
        SELECT 
          id,
          ts,
          summary,
          details,
          event_type,
          operation,
          created_at
        FROM entity_timeline
        WHERE entity_type = 'car'
          AND entity_id = ${device.car_id}
          AND source_type = 'starline'
          AND event_type = 'car.gps_updated'
        ORDER BY ts DESC
        LIMIT 10
      `;

      if (gpsHistory.length === 0) {
        console.log('❌ История GPS координат пуста в entity_timeline\n');
        console.log('💡 Возможные причины:');
        console.log('   1. GPS мониторинг еще не запускался');
        console.log('   2. Машина не двигалась (события сохраняются только при движении)');
        console.log('   3. Нужно запустить: POST /starline/update-gps\n');
      } else {
        console.log(`Найдено записей: ${gpsHistory.length}\n`);
        gpsHistory.forEach((record, index) => {
          const details = record.details || {};
          const lat = details.lat;
          const lng = details.lng;
          const mapsLink = lat && lng 
            ? `https://www.google.com/maps?q=${lat},${lng}`
            : null;
          
          console.log(`${index + 1}. ${record.ts || record.created_at}`);
          console.log(`   ├─ Сводка: ${record.summary || 'N/A'}`);
          if (lat !== undefined && lng !== undefined) {
            console.log(`   ├─ Координаты: ${lat}, ${lng}`);
            if (mapsLink) {
              console.log(`   ├─ Карта: ${mapsLink}`);
            }
          } else {
            console.log(`   ├─ Координаты: N/A`);
          }
          if (details.isMoving !== undefined) {
            console.log(`   ├─ Движется: ${details.isMoving ? '✅ Да' : '❌ Нет'}`);
          }
          if (details.distance !== undefined) {
            console.log(`   ├─ Дистанция: ${details.distance ? details.distance.toFixed(2) + ' м' : 'N/A'}`);
          }
          if (details.speed !== undefined) {
            console.log(`   ├─ Скорость: ${details.speed ? details.speed.toFixed(2) + ' км/ч' : 'N/A'}`);
          }
          console.log(`   ├─ Операция: ${record.operation || 'N/A'}`);
          console.log(`   └─ ID записи: ${record.id}`);
          console.log('');
        });
      }
    } else {
      console.log('\n⚠️  GPS данные недоступны - устройство не сопоставлено с машиной');
    }

    // 4. История сопоставлений
    console.log('═'.repeat(80));
    console.log('📜 ИСТОРИЯ СОПОСТАВЛЕНИЙ:\n');

    const matchHistory = await sql`
      SELECT 
        mh.matched,
        mh.confidence,
        mh.method,
        mh.starline_alias,
        mh.car_license_plate,
        mh.reason,
        mh.created_by,
        mh.created_at
      FROM starline_match_history mh
      WHERE mh.starline_device_id = ${device.id}
      ORDER BY mh.created_at DESC
      LIMIT 10
    `;

    if (matchHistory.length === 0) {
      console.log('❌ История сопоставлений пуста\n');
    } else {
      console.log(`Найдено записей: ${matchHistory.length}\n`);
      matchHistory.forEach((history, index) => {
        console.log(`${index + 1}. ${history.created_at}`);
        console.log(`   ├─ Сопоставлено: ${history.matched ? '✅ Да' : '❌ Нет'}`);
        if (history.confidence) {
          console.log(`   ├─ Уверенность: ${(history.confidence * 100).toFixed(0)}%`);
        }
        console.log(`   ├─ Метод: ${history.method || 'N/A'}`);
        console.log(`   ├─ Starline: ${history.starline_alias || 'N/A'}`);
        console.log(`   ├─ Машина: ${history.car_license_plate || 'N/A'}`);
        if (history.reason) {
          console.log(`   ├─ Причина: ${history.reason}`);
        }
        if (history.created_by) {
          console.log(`   └─ Создано: ${history.created_by}`);
        }
        console.log('');
      });
    }

    console.log('═'.repeat(80));
    console.log('✅ Проверка завершена!');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

showStarlineDevice();

