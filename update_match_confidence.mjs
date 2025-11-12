import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

const mappings = [
  { plate: 'OB700OB', deviceId: 864326066742275 },
  { plate: 'OC700OC', deviceId: 864326067074728 },
  { plate: 'UQ089QQ', deviceId: 868613068865584 },
  { plate: 'RR350FR', deviceId: 868613069004407 }
];

async function updateConfidence() {
  try {
    console.log('🔧 Обновление уверенности сопоставлений до 100%\n');
    console.log('═'.repeat(80));

    for (const mapping of mappings) {
      const cars = await sql`
        SELECT id, plate, car_visual_name FROM cars
        WHERE UPPER(REPLACE(plate, ' ', '')) = UPPER(REPLACE(${mapping.plate}, ' ', ''))
        LIMIT 1
      `;

      if (cars.length === 0) continue;

      const car = cars[0];
      const devices = await sql`
        SELECT id, device_id, alias, match_confidence
        FROM starline_devices
        WHERE car_id = ${car.id} AND device_id = ${mapping.deviceId}
        LIMIT 1
      `;

      if (devices.length > 0) {
        const device = devices[0];
        if (device.match_confidence !== 1.00) {
          console.log(`\n📋 ${car.car_visual_name || car.plate}:`);
          console.log(`   Устройство: ${device.alias}`);
          console.log(`   Старая уверенность: ${device.match_confidence ? (device.match_confidence * 100).toFixed(0) + '%' : 'N/A'}`);
          
          await sql`
            UPDATE starline_devices
            SET 
              match_confidence = 1.00,
              match_method = 'manual',
              match_notes = 'Правильное сопоставление (подтверждено)',
              updated_at = NOW()
            WHERE id = ${device.id}
          `;

          console.log(`   ✅ Обновлено до 100%`);
        } else {
          console.log(`\n📋 ${car.car_visual_name || car.plate}:`);
          console.log(`   ✅ Уже 100%`);
        }
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('✅ Обновление завершено!');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

updateConfidence();

