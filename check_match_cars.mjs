import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('🔍 Проверка JOIN в matchCars()...\n');
    
    // 1. Проверяем количество записей с matched = TRUE и active = TRUE
    const totalMatched = await sql`
      SELECT COUNT(*) as count
      FROM starline_devices
      WHERE matched = TRUE AND active = TRUE
    `;
    console.log(`1. Всего устройств с matched=TRUE и active=TRUE: ${totalMatched[0].count}`);
    
    // 2. Проверяем количество записей с car_id
    const withCarId = await sql`
      SELECT COUNT(*) as count
      FROM starline_devices
      WHERE matched = TRUE AND active = TRUE AND car_id IS NOT NULL
    `;
    console.log(`2. Из них с car_id: ${withCarId[0].count}`);
    
    // 3. Проверяем JOIN с cars
    const joinResult = await sql`
      SELECT COUNT(*) as count
      FROM starline_devices sd
      JOIN cars c ON c.id = sd.car_id
      WHERE sd.matched = TRUE AND sd.active = TRUE
    `;
    console.log(`3. JOIN с cars работает: ${joinResult[0].count} записей\n`);
    
    // 4. Проверяем сломанные связи (car_id не существует в cars)
    const brokenLinks = await sql`
      SELECT COUNT(*) as count
      FROM starline_devices sd
      WHERE sd.matched = TRUE 
        AND sd.active = TRUE 
        AND sd.car_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM cars c WHERE c.id = sd.car_id)
    `;
    console.log(`4. Сломанные связи (car_id не существует): ${brokenLinks[0].count}\n`);
    
    // 5. Получаем примеры записей из JOIN
    const examples = await sql`
      SELECT 
        sd.device_id,
        sd.alias,
        sd.car_id,
        sd.matched,
        c.plate,
        c.car_visual_name as brand,
        c.model
      FROM starline_devices sd
      JOIN cars c ON c.id = sd.car_id
      WHERE sd.matched = TRUE AND sd.active = TRUE
      LIMIT 5
    `;
    console.log('5. Примеры записей из JOIN:');
    console.log(JSON.stringify(examples, null, 2));
    
    // 6. Проверяем типы device_id
    const deviceIdTypes = await sql`
      SELECT 
        device_id,
        pg_typeof(device_id) as type,
        device_id::text as as_text,
        device_id::bigint as as_bigint
      FROM starline_devices
      WHERE matched = TRUE AND active = TRUE
      LIMIT 3
    `;
    console.log('\n6. Типы device_id:');
    console.log(JSON.stringify(deviceIdTypes, null, 2));
    
    // 7. Симулируем логику matchCars - получаем устройства из Starline (через API)
    console.log('\n7. Проверка сопоставления device_id...');
    const sampleDeviceIds = await sql`
      SELECT device_id FROM starline_devices 
      WHERE matched = TRUE AND active = TRUE 
      LIMIT 5
    `;
    console.log('Примеры device_id из БД:', sampleDeviceIds.map(d => d.device_id));
    
    // Проверяем, как они сравниваются
    const testMapping = await sql`
      SELECT 
        sd.device_id,
        sd.alias,
        sd.car_id,
        c.plate
      FROM starline_devices sd
      JOIN cars c ON c.id = sd.car_id
      WHERE sd.matched = TRUE 
        AND sd.active = TRUE
        AND sd.device_id = ANY(${sampleDeviceIds.map(d => d.device_id)})
    `;
    console.log('Найдено сопоставлений:', testMapping.length);
    console.log(JSON.stringify(testMapping, null, 2));
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
})();

