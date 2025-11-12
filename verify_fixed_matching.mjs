import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

const mappings = [
  { plate: 'OB700OB', deviceId: 864326066742275, deviceAlias: 'MB GLE 20--700' },
  { plate: 'OC700OC', deviceId: 864326067074728, deviceAlias: 'Santafe Black OC700OC' },
  { plate: 'UQ089QQ', deviceId: 868613068865584, deviceAlias: 'MB E350 RED UQ089QQ' },
  { plate: 'RR350FR', deviceId: 868613069004407, deviceAlias: 'Sportage Gray RR350FR' }
];

async function verify() {
  try {
    console.log('✅ Проверка исправленных сопоставлений\n');
    console.log('═'.repeat(80));

    for (const mapping of mappings) {
      const cars = await sql`
        SELECT id, plate, car_visual_name, model
        FROM cars
        WHERE UPPER(REPLACE(plate, ' ', '')) = UPPER(REPLACE(${mapping.plate}, ' ', ''))
        LIMIT 1
      `;

      if (cars.length === 0) {
        console.log(`\n❌ ${mapping.plate}: машина не найдена`);
        continue;
      }

      const car = cars[0];
      const devices = await sql`
        SELECT id, device_id, alias, matched, match_confidence, match_method
        FROM starline_devices
        WHERE car_id = ${car.id}
      `;

      console.log(`\n📋 ${car.car_visual_name || car.model} (${car.plate}):`);
      console.log(`   Количество устройств: ${devices.length}`);

      if (devices.length === 1) {
        const dev = devices[0];
        if (Number(dev.device_id) === Number(mapping.deviceId)) {
          console.log(`   ✅ Правильно: ${dev.alias} (${dev.device_id})`);
          console.log(`      Уверенность: ${dev.match_confidence ? (dev.match_confidence * 100).toFixed(0) + '%' : 'N/A'}`);
          console.log(`      Метод: ${dev.match_method || 'N/A'}`);
        } else {
          console.log(`   ❌ Неправильно: ${dev.alias} (${dev.device_id})`);
          console.log(`      Ожидалось: ${mapping.deviceId}`);
        }
      } else if (devices.length === 0) {
        console.log(`   ⚠️  Нет устройств`);
      } else {
        console.log(`   ⚠️  Найдено ${devices.length} устройств:`);
        devices.forEach(dev => {
          const status = Number(dev.device_id) === Number(mapping.deviceId) ? '✅' : '❌';
          console.log(`      ${status} ${dev.alias} (${dev.device_id})`);
        });
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('✅ Проверка завершена!');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

verify();

