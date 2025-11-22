import postgres from 'postgres';

const CONNECTION_STRING =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    console.log('📋 ПРОНУМЕРОВАННЫЙ СПИСОК ВСЕХ УСТРОЙСТВ ИЗ БД\n');
    console.log('═'.repeat(100));

    // Получаем все устройства из БД с привязками к машинам
    const devices = await sql`
      SELECT
        sd.id,
        sd.device_id,
        sd.alias as starline_alias,
        sd.matched,
        sd.match_confidence,
        sd.match_method,
        sd.car_id,
        c.plate as car_plate,
        c.car_visual_name as car_name,
        c.model as car_model,
        sd.active,
        sd.last_seen
      FROM starline_devices sd
      LEFT JOIN cars c ON c.id = sd.car_id
      ORDER BY sd.device_id
    `;

    console.log(`Всего устройств в БД: ${devices.length}\n`);
    console.log('═'.repeat(100));
    console.log('');

    let matchedCount = 0;
    let unmatchedCount = 0;
    let inactiveCount = 0;

    devices.forEach((device, index) => {
      const num = (index + 1).toString().padStart(3, ' ');
      const deviceId = device.device_id.toString().padEnd(15, ' ');
      const alias = (device.starline_alias || 'N/A').padEnd(45, ' ');

      let status = '';
      if (!device.active) {
        status = ' [НЕАКТИВНО]';
        inactiveCount++;
      }

      if (device.matched && device.car_id) {
        matchedCount++;
        const carInfo = `${device.car_plate || 'N/A'} (${device.car_name || device.car_model || 'N/A'})`;
        const confidence = device.match_confidence
          ? ` [${(device.match_confidence * 100).toFixed(0)}%]`
          : '';
        console.log(
          `${num}. Device ${deviceId} | ${alias} → ${carInfo}${confidence}${status}`,
        );
      } else {
        unmatchedCount++;
        console.log(
          `${num}. Device ${deviceId} | ${alias} → НЕ ПРИВЯЗАНО${status}`,
        );
      }
    });

    console.log('');
    console.log('═'.repeat(100));
    console.log('\n📊 ИТОГИ:');
    console.log(`   Всего устройств в БД: ${devices.length}`);
    console.log(`   ✅ Привязано к машинам: ${matchedCount}`);
    console.log(`   ⚠️  Не привязано: ${unmatchedCount}`);
    console.log(`   🔴 Неактивных: ${inactiveCount}`);
    console.log('');
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();

