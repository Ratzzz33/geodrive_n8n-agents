import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔄 Синхронизация starline_devices из gps_tracking...\n');

  // ШАГ 1: Найти все уникальные пары (device_id, car_id) из gps_tracking
  // Берем последний alias для каждого device_id (самый актуальный)
  const gpsMappings = await sql`
    SELECT DISTINCT ON (gt.starline_device_id)
      gt.starline_device_id::BIGINT as device_id,
      gt.car_id,
      gt.starline_alias,
      c.plate,
      c.car_visual_name,
      c.model,
      c.avatar_url
    FROM gps_tracking gt
    JOIN cars c ON c.id = gt.car_id
    WHERE gt.starline_device_id IS NOT NULL
      AND gt.car_id IS NOT NULL
      AND gt.starline_device_id::BIGINT IN (
        SELECT device_id FROM starline_devices
      )
    ORDER BY gt.starline_device_id, gt.last_sync DESC
  `;

  console.log(`📊 Найдено ${gpsMappings.length} уникальных сопоставлений в gps_tracking\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  // ШАГ 2: Обновить starline_devices для каждого сопоставления
  for (const mapping of gpsMappings) {
    try {
      // Проверяем, что device_id существует в starline_devices
      const [existingDevice] = await sql`
        SELECT id, device_id, car_id, matched, alias, extracted_model
        FROM starline_devices
        WHERE device_id = ${mapping.device_id}
      `;

      if (!existingDevice) {
        console.log(`⚠️ Устройство ${mapping.device_id} не найдено в starline_devices, пропускаем`);
        skipped++;
        continue;
      }

      // Обновляем starline_devices
      // ВАЖНО: alias обновляем из gps_tracking (актуальные данные парсинга)
      // extracted_model заполняем из cars.model
      // plate заполняем из cars.plate для удобного поиска
      const result = await sql`
        UPDATE starline_devices
        SET 
          car_id = ${mapping.car_id},
          matched = TRUE,
          match_confidence = 1.00,
          match_method = 'gps_tracking_sync',
          match_notes = ${`Синхронизировано из gps_tracking: ${mapping.plate} (${mapping.car_visual_name || mapping.model})`},
          alias = ${mapping.starline_alias}, -- ОБНОВЛЯЕМ alias из актуальных данных парсинга
          extracted_model = ${mapping.model}, -- ЗАПОЛНЯЕМ extracted_model из cars.model
          plate = ${mapping.plate}, -- ЗАПОЛНЯЕМ plate из cars.plate для удобного поиска
          avatar_url = ${mapping.avatar_url}, -- ЗАПОЛНЯЕМ avatar_url из cars.avatar_url
          last_seen = NOW(),
          updated_at = NOW()
        WHERE device_id = ${mapping.device_id}
        RETURNING id, device_id, alias, extracted_model, plate, avatar_url, car_id, matched
      `;

      if (result.length > 0) {
        const updatedDevice = result[0];
        const aliasChanged = existingDevice.alias !== mapping.starline_alias;
        const modelChanged = existingDevice.extracted_model !== mapping.model;
        const plateChanged = existingDevice.plate !== mapping.plate;
        
        let changes = [];
        if (aliasChanged) changes.push(`alias: "${existingDevice.alias}" -> "${mapping.starline_alias}"`);
        if (modelChanged) changes.push(`extracted_model: "${existingDevice.extracted_model || 'NULL'}" -> "${mapping.model}"`);
        if (plateChanged) changes.push(`plate: "${existingDevice.plate || 'NULL'}" -> "${mapping.plate}"`);
        
        console.log(`✅ Обновлено: device_id=${mapping.device_id} -> car_id=${mapping.car_id} (${mapping.plate})`);
        if (changes.length > 0) {
          console.log(`   Изменения: ${changes.join(', ')}`);
        }
        updated++;
      } else {
        console.log(`⚠️ Не удалось обновить device_id=${mapping.device_id}`);
        skipped++;
      }
    } catch (error) {
      console.error(`❌ Ошибка при обновлении device_id=${mapping.device_id}:`, error.message);
      errors++;
    }
  }

  console.log('\n📊 Итоги синхронизации:');
  console.log(`   ✅ Обновлено: ${updated}`);
  console.log(`   ⚠️ Пропущено: ${skipped}`);
  console.log(`   ❌ Ошибок: ${errors}`);

  // ШАГ 3: Показать итоговое состояние
  console.log('\n🔍 Проверка результата:\n');
  const finalState = await sql`
    SELECT 
      sd.device_id,
      sd.alias,
      sd.extracted_model,
      sd.plate,
      sd.car_id,
      sd.matched,
      sd.match_confidence,
      sd.match_method,
      c.plate as car_plate,
      c.car_visual_name,
      c.model as car_model
    FROM starline_devices sd
    LEFT JOIN cars c ON c.id = sd.car_id
    WHERE sd.matched = TRUE
    ORDER BY sd.device_id
  `;

  console.log(`📋 Всего сопоставленных устройств: ${finalState.length}`);
  for (const device of finalState) {
    const modelMatch = device.extracted_model === device.car_model ? '✅' : '⚠️';
    const plateMatch = device.plate === device.car_plate ? '✅' : '⚠️';
    console.log(`   Device ${device.device_id}: ${device.alias}`);
    console.log(`      -> plate: ${device.plate || 'NULL'} ${plateMatch} car_plate: ${device.car_plate || 'NULL'} (${device.car_visual_name || device.car_model || 'N/A'})`);
    console.log(`      extracted_model: ${device.extracted_model} ${modelMatch} car_model: ${device.car_model}`);
  }

} catch (error) {
  console.error('❌ Критическая ошибка:', error);
} finally {
  await sql.end();
}

