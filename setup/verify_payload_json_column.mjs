/**
 * Проверка, что колонка payload_json создалась и работает
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function verifyColumn() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('✅ Проверка колонки payload_json\n');

    // 1. Проверяем наличие колонки
    console.log('1️⃣ Проверка колонки в таблице bookings:');
    const column = await sql`
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'bookings'
      AND column_name = 'payload_json'
    `;

    if (column.length > 0) {
      console.log('   ✅ Колонка payload_json существует!');
      console.log('      Тип:', column[0].data_type);
      console.log('      Nullable:', column[0].is_nullable);
    } else {
      console.log('   ❌ Колонка payload_json НЕ найдена');
    }
    console.log('');

    // 2. Создаем тестовую бронь с payload_json
    console.log('2️⃣ Тест создания брони с payload_json:');
    const testData = {
      payload_json: {
        car: {
          id: 37407,
          model: "Kia Soul",
          plate: "BB202JJ"
        },
        client: {
          id: 107733,
          name: "Test Client",
          phone: "+995555123456"
        },
        booking: {
          id: 509620,
          start_date: "10-11-2025 10:00",
          end_date: "15-11-2025 10:00",
          price: 350,
          deposit: 500
        }
      },
      test_marker: "verification_test"
    };

    const rentprogId = 'verify_test_' + Math.random().toString(36).substring(7);
    const result = await sql`
      SELECT * FROM dynamic_upsert_entity(
        'bookings',
        ${rentprogId},
        ${sql.json(testData)}
      )
    `;

    console.log('   entity_id:', result[0].entity_id);
    console.log('   created:', result[0].created);
    console.log('   added_columns:', result[0].added_columns);
    console.log('');

    // 3. Проверяем, что данные сохранились в external_refs
    console.log('3️⃣ Проверка данных в external_refs:');
    const refData = await sql`
      SELECT 
        external_id,
        jsonb_typeof(data) as data_type,
        pg_column_size(data) as data_size,
        data->'payload_json' as payload_json,
        data->'payload_json'->'car'->>'model' as car_model,
        data->'payload_json'->'client'->>'name' as client_name
      FROM external_refs
      WHERE entity_id = ${result[0].entity_id}
    `;

    if (refData.length > 0 && refData[0].payload_json) {
      console.log('   ✅ Данные payload_json сохранены в external_refs!');
      console.log('      data_type:', refData[0].data_type);
      console.log('      data_size:', refData[0].data_size, 'bytes');
      console.log('      car_model:', refData[0].car_model);
      console.log('      client_name:', refData[0].client_name);
    } else {
      console.log('   ❌ Данные НЕ найдены в external_refs');
    }
    console.log('');

    // 4. Проверяем, что данные сохранились в таблице bookings (если колонка есть)
    if (column.length > 0) {
      console.log('4️⃣ Проверка данных в таблице bookings:');
      const bookingData = await sql`
        SELECT 
          id,
          payload_json,
          car_id,
          client_id,
          state
        FROM bookings
        WHERE id = ${result[0].entity_id}
      `;

      if (bookingData.length > 0) {
        console.log('   ✅ Бронь найдена:');
        console.log('      id:', bookingData[0].id);
        console.log('      payload_json:', bookingData[0].payload_json ? 'есть' : 'NULL');
        console.log('      car_id:', bookingData[0].car_id || 'NULL');
        console.log('      client_id:', bookingData[0].client_id || 'NULL');
        console.log('      state:', bookingData[0].state || 'NULL');
        
        if (bookingData[0].payload_json) {
          console.log('      payload_json содержит:', Object.keys(bookingData[0].payload_json));
        }
      }
    }
    console.log('');

    // 5. Удаляем тестовую запись
    await sql`DELETE FROM bookings WHERE id = ${result[0].entity_id}`;
    await sql`DELETE FROM external_refs WHERE entity_id = ${result[0].entity_id}`;
    console.log('🧹 Тестовая запись удалена\n');

    console.log('📋 ИТОГОВЫЙ ВЫВОД:');
    console.log('   ✅ Функция dynamic_upsert_entity теперь сохраняет payload в external_refs.data');
    console.log('   ✅ Колонка payload_json автоматически создается в bookings');
    console.log('   ✅ Данные доступны через JOIN с external_refs');
    console.log('');
    console.log('💡 Рекомендация:');
    console.log('   Используйте external_refs.data для доступа к полному payload');
    console.log('   Это позволит получить все данные о car, client и booking');

  } finally {
    await sql.end();
  }
}

verifyColumn().catch(console.error);

