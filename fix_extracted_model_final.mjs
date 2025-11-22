import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function fixExtractedModel() {
  try {
    console.log('🔧 Финальное исправление extracted_model из cars.model\n');

    // Обновляем extracted_model из cars.model для всех сопоставленных устройств
    const result = await sql`
      UPDATE starline_devices sd
      SET extracted_model = c.model
      FROM cars c
      WHERE sd.car_id = c.id
        AND sd.matched = TRUE
        AND c.model IS NOT NULL
        AND (sd.extracted_model IS NULL OR sd.extracted_model != c.model)
      RETURNING 
        sd.device_id,
        sd.alias,
        sd.extracted_model as new_extracted_model,
        c.plate,
        c.model as car_model
    `;

    console.log(`✅ Обновлено записей: ${result.length}\n`);

    if (result.length > 0) {
      console.log('📋 Обновленные записи:');
      for (const r of result) {
        console.log(`   ${r.plate}: "${r.alias}" → extracted_model: "${r.new_extracted_model}"`);
      }
    }

    // Проверяем финальное состояние для DK700DK и OC700OC
    console.log('\n\n📋 Финальная проверка DK700DK и OC700OC:');
    const finalCheck = await sql`
      SELECT 
        sd.device_id,
        sd.alias,
        sd.extracted_model,
        c.plate,
        c.model as car_model
      FROM starline_devices sd
      JOIN cars c ON c.id = sd.car_id
      WHERE UPPER(REPLACE(c.plate, ' ', '')) IN ('DK700DK', 'OC700OC')
      ORDER BY c.plate
    `;

    for (const device of finalCheck) {
      console.log(`\n   🚗 ${device.plate} (${device.car_model}):`);
      console.log(`      Device ID: ${device.device_id}`);
      console.log(`      Alias: "${device.alias}"`);
      console.log(`      Extracted Model: "${device.extracted_model}"`);
      
      // Проверяем корректность
      const isCorrect = device.extracted_model === device.car_model;
      if (isCorrect) {
        console.log(`      ✅ extracted_model корректный`);
      } else {
        console.log(`      ⚠️ extracted_model не совпадает с car_model`);
      }
    }

    console.log('\n\n✅ Финальное исправление завершено!\n');

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

fixExtractedModel();

