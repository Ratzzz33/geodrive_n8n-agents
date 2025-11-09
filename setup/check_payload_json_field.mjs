/**
 * Проверка поля payload_json в таблице bookings
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkPayloadJsonField() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 Проверка поля payload_json в таблице bookings\n');

    // 1. Проверяем, есть ли колонка payload_json
    console.log('1️⃣ Проверка существования колонки:');
    const column = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'bookings'
      AND column_name = 'payload_json'
    `;
    
    if (column.length > 0) {
      console.log('   ✅ Колонка payload_json существует:');
      console.log('      Тип:', column[0].data_type);
      console.log('      Nullable:', column[0].is_nullable);
    } else {
      console.log('   ❌ Колонка payload_json НЕ НАЙДЕНА в таблице bookings!');
    }
    console.log('');

    // 2. Список всех JSONB колонок в bookings
    console.log('2️⃣ Все JSONB колонки в таблице bookings:');
    const jsonbColumns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'bookings'
      AND data_type = 'jsonb'
      ORDER BY ordinal_position
    `;
    
    if (jsonbColumns.length > 0) {
      jsonbColumns.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('   Нет JSONB колонок');
    }
    console.log('');

    // 3. Проверяем конкретную бронь из execution
    console.log('3️⃣ Проверка брони 3acdc990-9d44-49b3-a243-5a454d70c082:');
    const booking = await sql`
      SELECT 
        id,
        data,
        payload_json,
        car_id,
        client_id,
        state,
        start_at,
        end_at
      FROM bookings
      WHERE id = '3acdc990-9d44-49b3-a243-5a454d70c082'
    `.catch(() => {
      // Если payload_json не существует, запрос упадет
      return sql`
        SELECT 
          id,
          data,
          car_id,
          client_id,
          state,
          start_at,
          end_at
        FROM bookings
        WHERE id = '3acdc990-9d44-49b3-a243-5a454d70c082'
      `;
    });
    
    if (booking.length > 0) {
      console.log('   Найдена бронь:');
      console.log('   ID:', booking[0].id);
      console.log('   car_id:', booking[0].car_id || 'NULL');
      console.log('   client_id:', booking[0].client_id || 'NULL');
      console.log('   state:', booking[0].state || 'NULL');
      console.log('   start_at:', booking[0].start_at || 'NULL');
      console.log('   end_at:', booking[0].end_at || 'NULL');
      console.log('   data:', booking[0].data ? 'есть' : 'NULL');
      if (booking[0].payload_json !== undefined) {
        console.log('   payload_json:', booking[0].payload_json ? 'есть' : 'NULL');
      }
    } else {
      console.log('   ❌ Бронь НЕ найдена!');
    }
    console.log('');

    // 4. Проверяем external_refs для этой брони
    console.log('4️⃣ External refs для этой брони:');
    const refs = await sql`
      SELECT 
        external_id as rentprog_id,
        data,
        meta,
        created_at
      FROM external_refs
      WHERE entity_id = '3acdc990-9d44-49b3-a243-5a454d70c082'
      AND entity_type = 'booking'
    `;
    
    if (refs.length > 0) {
      console.log(`   Найдено external_refs: ${refs.length}`);
      refs.forEach(ref => {
        console.log(`   RentProg ID: ${ref.rentprog_id}`);
        console.log(`   Создан: ${ref.created_at}`);
        if (ref.data) {
          const dataStr = JSON.stringify(ref.data);
          console.log(`   Data (${dataStr.length} символов):`, dataStr.substring(0, 200) + '...');
        }
      });
    } else {
      console.log('   ❌ External refs НЕ найдены!');
    }
    console.log('');

    console.log('📋 ВЫВОД:');
    console.log('   • Если payload_json НЕ существует - нужно добавить колонку');
    console.log('   • Если существует но NULL - проверить функцию dynamic_upsert_entity');
    console.log('   • Данные из payload должны попадать либо в bookings.payload_json');
    console.log('   • Либо в external_refs.data (текущая архитектура)');

  } finally {
    await sql.end();
  }
}

checkPayloadJsonField().catch(console.error);

