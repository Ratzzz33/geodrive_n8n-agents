import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔍 Проверка сопоставления устройств Starline для OB700OB и OC700OC\n');

  // Проверяем устройство 864326066742275 (должно быть OB700OB)
  const device1 = await sql`
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
    WHERE sd.device_id = 864326066742275
  `;

  console.log('📡 Устройство 864326066742275 (должно быть OB700OB):');
  console.log(JSON.stringify(device1, null, 2));
  console.log('');

  // Проверяем устройство 864326067074728 (должно быть OC700OC)
  const device2 = await sql`
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
    WHERE sd.device_id = 864326067074728
  `;

  console.log('📡 Устройство 864326067074728 (должно быть OC700OC):');
  console.log(JSON.stringify(device2, null, 2));
  console.log('');

  // Проверяем машины
  const car1 = await sql`
    SELECT id, plate, car_visual_name, model
    FROM cars
    WHERE plate = 'OB700OB'
  `;

  console.log('🚗 Машина OB700OB:');
  console.log(JSON.stringify(car1, null, 2));
  console.log('');

  const car2 = await sql`
    SELECT id, plate, car_visual_name, model
    FROM cars
    WHERE plate = 'OC700OC'
  `;

  console.log('🚗 Машина OC700OC:');
  console.log(JSON.stringify(car2, null, 2));
  console.log('');

  // Проверяем все устройства с alias содержащим OB700OB или OC700OC
  const allDevices = await sql`
    SELECT 
      sd.device_id,
      sd.alias,
      sd.car_id,
      sd.matched,
      c.plate,
      c.car_visual_name
    FROM starline_devices sd
    LEFT JOIN cars c ON c.id = sd.car_id
    WHERE sd.alias LIKE '%OB700OB%' 
       OR sd.alias LIKE '%OC700OC%'
       OR sd.device_id IN (864326066742275, 864326067074728)
    ORDER BY sd.device_id
  `;

  console.log('📋 Все устройства с OB700OB/OC700OC в alias:');
  console.log(JSON.stringify(allDevices, null, 2));
  console.log('');

  // Проверяем текущие GPS данные
  const gps1 = await sql`
    SELECT * FROM gps_tracking
    WHERE car_id = ${car1[0]?.id || null}
  `;

  console.log('📍 GPS данные для OB700OB:');
  console.log(JSON.stringify(gps1, null, 2));
  console.log('');

  const gps2 = await sql`
    SELECT * FROM gps_tracking
    WHERE car_id = ${car2[0]?.id || null}
  `;

  console.log('📍 GPS данные для OC700OC:');
  console.log(JSON.stringify(gps2, null, 2));

} catch (error) {
  console.error('❌ Ошибка:', error);
} finally {
  await sql.end();
}

