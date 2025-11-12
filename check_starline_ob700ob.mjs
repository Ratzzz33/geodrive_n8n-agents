import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkStarlineData() {
  try {
    console.log('🔍 Поиск данных по Starline для Mercedes Benz GLE 350 (OB700OB)\n');

    // Нормализуем номер (убираем пробелы, приводим к верхнему регистру)
    const plate = 'OB700OB';
    const plateNormalized = plate.toUpperCase().replace(/\s+/g, '');

    // Ищем машину по номеру
    const cars = await sql`
      SELECT 
        c.id,
        c.plate,
        c.car_visual_name,
        c.model,
        c.vin,
        c.starline_id,
        c.branch_id,
        b.code as branch_code,
        b.name as branch_name,
        c.created_at,
        c.updated_at,
        c.data
      FROM cars c
      LEFT JOIN branches b ON b.id = c.branch_id
      WHERE UPPER(REPLACE(c.plate, ' ', '')) = ${plateNormalized}
         OR UPPER(REPLACE(c.plate, ' ', '')) LIKE '%700%'
    `;

    if (cars.length === 0) {
      console.log('❌ Машина с номером OB700OB не найдена в БД');
      console.log('\n💡 Варианты:');
      console.log('   1. Машина еще не синхронизирована из RentProg');
      console.log('   2. Номер записан в другом формате');
      console.log('   3. Нужно создать запись вручную или синхронизировать из RentProg');
      
      // Проверяем есть ли устройство Starline с таким номером
      const starlineDevices = await sql`
        SELECT 
          id,
          device_id,
          alias,
          extracted_model,
          extracted_digits,
          matched,
          car_id,
          imei,
          phone,
          active,
          last_seen
        FROM starline_devices
        WHERE alias ILIKE '%700%'
           OR extracted_digits = '700'
        ORDER BY last_seen DESC
      `;
      
      if (starlineDevices.length > 0) {
        console.log('\n📡 Найдены устройства Starline с номером 700:');
        starlineDevices.forEach(device => {
          console.log(`   - ${device.alias} (Device ID: ${device.device_id})`);
          console.log(`     Сопоставлено: ${device.matched ? 'Да' : 'Нет'}`);
          if (device.car_id) {
            console.log(`     Car ID: ${device.car_id}`);
          }
        });
      }
      
      return;
    }

    console.log(`✅ Найдено машин: ${cars.length}\n`);

    for (const car of cars) {
      console.log('═'.repeat(60));
      console.log(`📋 Машина:`);
      console.log(`   ID: ${car.id}`);
      console.log(`   Госномер: ${car.plate || 'не указан'}`);
      console.log(`   Название: ${car.car_visual_name || car.model || 'не указано'}`);
      console.log(`   Модель: ${car.model || 'не указана'}`);
      console.log(`   VIN: ${car.vin || 'не указан'}`);
      console.log(`   Starline ID (старое поле): ${car.starline_id || 'не указан'}`);
      console.log(`   Филиал: ${car.branch_name || 'не указан'} (${car.branch_code || 'N/A'})`);
      console.log(`   Создана: ${car.created_at}`);
      console.log(`   Обновлена: ${car.updated_at}`);
      console.log('');

      // Ищем устройство Starline через таблицу starline_devices
      const starlineDevices = await sql`
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
          sd.updated_at
        FROM starline_devices sd
        WHERE sd.car_id = ${car.id}
        ORDER BY sd.last_seen DESC
      `;

      if (starlineDevices.length > 0) {
        console.log(`📡 Устройства Starline (найдено: ${starlineDevices.length}):`);
        starlineDevices.forEach((device, index) => {
          console.log(`\n   Устройство ${index + 1}:`);
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
            console.log(`   ├─ Метод: ${device.match_method}`);
          }
          if (device.match_notes) {
            console.log(`   ├─ Заметки: ${device.match_notes}`);
          }
          console.log(`   ├─ IMEI: ${device.imei || 'N/A'}`);
          console.log(`   ├─ Телефон: ${device.phone || 'N/A'}`);
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
      } else {
        console.log('📡 Устройства Starline: не найдено');
        console.log('   💡 Возможные причины:');
        console.log('      1. Устройство еще не синхронизировано из Starline');
        console.log('      2. Устройство не сопоставлено с этой машиной');
        console.log('      3. Нужно запустить синхронизацию: POST /starline/sync-devices');
        console.log('      4. Нужно запустить сопоставление: POST /starline/match-devices');
      }
      console.log('');

      // Ищем устройства Starline по номеру (может быть несопоставленное)
      const unmatchedDevices = await sql`
        SELECT 
          sd.id,
          sd.device_id,
          sd.alias,
          sd.extracted_model,
          sd.extracted_digits,
          sd.matched,
          sd.active,
          sd.last_seen
        FROM starline_devices sd
        WHERE (sd.alias ILIKE '%700%' OR sd.extracted_digits = '700')
          AND (sd.car_id IS NULL OR sd.car_id != ${car.id})
        ORDER BY sd.last_seen DESC
        LIMIT 5
      `;

      if (unmatchedDevices.length > 0) {
        console.log('🔍 Возможные несопоставленные устройства Starline с номером 700:');
        unmatchedDevices.forEach(device => {
          console.log(`   - ${device.alias} (Device ID: ${device.device_id})`);
          console.log(`     Сопоставлено: ${device.matched ? 'Да' : 'Нет'}`);
          console.log(`     Активно: ${device.active ? 'Да' : 'Нет'}`);
        });
        console.log('');
      }

      // Ищем внешние ссылки (RentProg и другие системы)
      const externalRefs = await sql`
        SELECT 
          er.system,
          er.external_id,
          er.branch_code,
          er.meta,
          er.created_at
        FROM external_refs er
        WHERE er.entity_id = ${car.id}
          AND er.entity_type = 'car'
        ORDER BY er.system, er.created_at DESC
      `;

      if (externalRefs.length > 0) {
        console.log('🔗 Внешние ссылки:');
        externalRefs.forEach(ref => {
          console.log(`   - ${ref.system}: ${ref.external_id}`);
          if (ref.branch_code) {
            console.log(`     Филиал: ${ref.branch_code}`);
          }
        });
        console.log('');
      }

      // История сопоставлений Starline
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
        JOIN starline_devices sd ON sd.id = mh.starline_device_id
        WHERE sd.car_id = ${car.id}
        ORDER BY mh.created_at DESC
        LIMIT 10
      `;

      if (matchHistory.length > 0) {
        console.log('📜 История сопоставлений Starline (последние 10):');
        matchHistory.forEach((history, index) => {
          console.log(`\n   ${index + 1}. ${history.created_at}`);
          console.log(`      Сопоставлено: ${history.matched ? '✅ Да' : '❌ Нет'}`);
          if (history.confidence) {
            console.log(`      Уверенность: ${(history.confidence * 100).toFixed(0)}%`);
          }
          console.log(`      Метод: ${history.method || 'N/A'}`);
          console.log(`      Starline: ${history.starline_alias || 'N/A'}`);
          console.log(`      Машина: ${history.car_license_plate || 'N/A'}`);
          if (history.reason) {
            console.log(`      Причина: ${history.reason}`);
          }
          if (history.created_by) {
            console.log(`      Создано: ${history.created_by}`);
          }
        });
        console.log('');
      }
    }

    console.log('═'.repeat(60));
    console.log('✅ Проверка завершена!');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkStarlineData();

