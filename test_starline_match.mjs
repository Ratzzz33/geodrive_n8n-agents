import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔍 Симуляция логики matchCars() для устройств OB700OB и OC700OC\n');

  // Получаем все сопоставленные устройства из starline_devices (как в matchCars)
  const deviceMappings = await sql`
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
    WHERE sd.matched = TRUE
      AND sd.active = TRUE
      AND sd.device_id IN (864326066742275, 864326067074728)
  `;

  console.log('📋 Сопоставления из starline_devices:');
  console.log(JSON.stringify(deviceMappings, null, 2));
  console.log('');

  // Симулируем устройства от Starline (как они приходят из scraper.getDevices())
  // В execution видно, что alias "MB GLE OB700OB" пришел для устройства, которое записалось в OC700OC
  const simulatedDevices = [
    { device_id: 864326066742275, alias: 'MB GLE 20--700' }, // Текущий alias в БД
    { device_id: 864326067074728, alias: 'MB GLE OB700OB' }  // Alias из execution (изменился!)
  ];

  console.log('📡 Симулированные устройства от Starline:');
  console.log(JSON.stringify(simulatedDevices, null, 2));
  console.log('');

  // Логика matchCars()
  const matches = [];
  for (const device of simulatedDevices) {
    const mapping = deviceMappings.find(m => m.device_id === device.device_id.toString());
    
    if (mapping && mapping.matched && mapping.car_id) {
      matches.push({
        carId: mapping.car_id,
        plate: mapping.plate,
        brand: mapping.brand || '',
        model: mapping.model,
        starlineDeviceId: device.device_id,
        starlineAlias: device.alias
      });
      console.log(`✅ Сопоставлено по device_id: ${device.device_id} (${device.alias}) -> ${mapping.brand || ''} ${mapping.model} (${mapping.plate})`);
    } else {
      console.log(`⚠️ Устройство ${device.device_id} (${device.alias}) не сопоставлено в starline_devices`);
    }
  }

  console.log('\n📊 Результат сопоставления:');
  console.log(JSON.stringify(matches, null, 2));

} catch (error) {
  console.error('❌ Ошибка:', error);
} finally {
  await sql.end();
}

