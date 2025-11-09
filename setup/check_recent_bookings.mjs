/**
 * Проверка недавно созданных броней
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkRecentBookings() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 Проверка недавно созданных броней\n');

    // 1. Последние 10 броней
    console.log('1️⃣ Последние 10 броней:');
    const recentBookings = await sql`
      SELECT 
        id,
        car_id,
        client_id,
        state,
        start_at,
        end_at,
        created_at,
        updated_at,
        (SELECT COUNT(*) > 0 FROM external_refs WHERE entity_id = bookings.id) as has_external_ref
      FROM bookings
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    recentBookings.forEach((booking, idx) => {
      console.log(`\n   ${idx + 1}. ID: ${booking.id}`);
      console.log(`      Создан: ${booking.created_at}`);
      console.log(`      Обновлен: ${booking.updated_at}`);
      console.log(`      car_id: ${booking.car_id || 'NULL'}`);
      console.log(`      client_id: ${booking.client_id || 'NULL'}`);
      console.log(`      state: ${booking.state || 'NULL'}`);
      console.log(`      has_external_ref: ${booking.has_external_ref}`);
    });
    console.log('');

    // 2. Проверка external_refs для броней
    console.log('2️⃣ Недавние external_refs для booking:');
    const recentRefs = await sql`
      SELECT 
        entity_id,
        external_id as rentprog_id,
        created_at,
        jsonb_typeof(data) as data_type,
        CASE 
          WHEN data IS NOT NULL THEN pg_column_size(data)
          ELSE 0
        END as data_size_bytes
      FROM external_refs
      WHERE entity_type = 'booking'
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    recentRefs.forEach((ref, idx) => {
      console.log(`\n   ${idx + 1}. Entity ID: ${ref.entity_id}`);
      console.log(`      RentProg ID: ${ref.rentprog_id}`);
      console.log(`      Создан: ${ref.created_at}`);
      console.log(`      data type: ${ref.data_type}`);
      console.log(`      data size: ${ref.data_size_bytes} bytes`);
    });
    console.log('');

    // 3. Проверка, есть ли функция dynamic_upsert_entity
    console.log('3️⃣ Проверка функции dynamic_upsert_entity:');
    const func = await sql`
      SELECT 
        routine_name,
        routine_type,
        data_type
      FROM information_schema.routines
      WHERE routine_name = 'dynamic_upsert_entity'
      AND routine_schema = 'public'
    `;
    
    if (func.length > 0) {
      console.log('   ✅ Функция найдена');
      console.log('      Type:', func[0].routine_type);
    } else {
      console.log('   ❌ Функция НЕ найдена!');
    }
    console.log('');

    // 4. Проверка структуры вызова функции
    console.log('4️⃣ Тест вызова функции (минимальный payload):');
    try {
      const testResult = await sql`
        SELECT * FROM dynamic_upsert_entity(
          'bookings',
          'test_' || gen_random_uuid()::text,
          '{"test_field": "test_value", "payload_json": {"car": {"id": 123}, "client": {"id": 456}}}'::jsonb
        )
      `;
      console.log('   ✅ Функция выполнилась:');
      console.log('      entity_id:', testResult[0].entity_id);
      console.log('      created:', testResult[0].created);
      console.log('      added_columns:', testResult[0].added_columns);

      // Проверяем, создалась ли запись
      const testBooking = await sql`
        SELECT id, test_field, payload_json
        FROM bookings
        WHERE id = ${testResult[0].entity_id}
      `.catch(() => {
        // payload_json может не существовать
        return sql`
          SELECT id
          FROM bookings
          WHERE id = ${testResult[0].entity_id}
        `;
      });

      if (testBooking.length > 0) {
        console.log('   ✅ Тестовая бронь создана');
        if (testBooking[0].payload_json !== undefined) {
          console.log('      payload_json:', testBooking[0].payload_json ? 'есть' : 'NULL');
        }
      }

      // Удаляем тестовую запись
      await sql`DELETE FROM bookings WHERE id = ${testResult[0].entity_id}`;
      await sql`DELETE FROM external_refs WHERE entity_id = ${testResult[0].entity_id}`;
      console.log('   🧹 Тестовая запись удалена');

    } catch (error) {
      console.log('   ❌ Ошибка при вызове функции:');
      console.log('      ', error.message);
    }

  } finally {
    await sql.end();
  }
}

checkRecentBookings().catch(console.error);

