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
    console.log('🔧 Синхронизуем plate в starline_devices из таблицы cars\n');

    const updated = await sql`
      UPDATE starline_devices sd
      SET plate = c.plate
      FROM cars c
      WHERE sd.car_id = c.id
        AND sd.matched = TRUE
        AND c.plate IS NOT NULL
        AND (
          sd.plate IS DISTINCT FROM c.plate
          OR sd.plate IS NULL
        )
      RETURNING
        sd.device_id,
        sd.alias,
        c.plate AS new_plate
    `;

    console.log(`✅ Обновлено записей: ${updated.length}`);
    if (updated.length > 0) {
      updated.forEach((row, index) => {
        console.log(
          `${index + 1}. Device ${row.device_id} "${row.alias}" → plate="${row.new_plate}"`,
        );
      });
    }

    console.log('\n🔎 Проверяем оставшиеся расхождения...');
    const mismatches = await sql`
      SELECT
        sd.device_id,
        sd.alias,
        sd.plate AS stored_plate,
        c.plate AS car_plate
      FROM starline_devices sd
      JOIN cars c ON c.id = sd.car_id
      WHERE sd.matched = TRUE
        AND c.plate IS NOT NULL
        AND sd.plate IS DISTINCT FROM c.plate
      ORDER BY c.plate
    `;

    if (mismatches.length === 0) {
      console.log('🎉 Все сопоставленные устройства имеют актуальный plate.');
    } else {
      console.log(`⚠️ Осталось несоответствий: ${mismatches.length}`);
      mismatches.forEach((row, index) => {
        console.log(
          `${index + 1}. Device ${row.device_id} "${row.alias}" → stored="${row.stored_plate}", actual="${row.car_plate}"`,
        );
      });
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('❌ Ошибка при синхронизации:', error);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();


