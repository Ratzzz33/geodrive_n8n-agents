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
    console.log('🔎 Проверяем расхождения между starline_devices.extracted_model и cars.model\n');

    const mismatches = await sql`
      SELECT
        c.plate,
        c.car_visual_name,
        c.model AS car_model,
        sd.alias AS starline_alias,
        sd.extracted_model
      FROM starline_devices sd
      JOIN cars c ON c.id = sd.car_id
      WHERE sd.matched = TRUE
        AND c.model IS NOT NULL
        AND sd.extracted_model IS DISTINCT FROM c.model
      ORDER BY c.plate
    `;

    if (mismatches.length === 0) {
      console.log('✅ Все сопоставленные устройства имеют корректный extracted_model.\n');
      return;
    }

    console.log(`⚠️ Найдено несоответствий: ${mismatches.length}\n`);
    mismatches.forEach((row, index) => {
      const carName = row.car_visual_name ? `${row.car_visual_name} ${row.car_model}` : row.car_model;
      console.log(
        `${index + 1}. ${row.plate}: alias "${row.starline_alias}" → extracted_model="${row.extracted_model}", car="${carName}"`,
      );
    });
  } catch (error) {
    console.error('❌ Ошибка проверки:', error);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();


