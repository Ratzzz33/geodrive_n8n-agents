/**
 * Исправление функции dynamic_upsert_entity:
 * ДОБАВИТЬ сохранение p_data в external_refs.data
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function fixFunction() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔧 Исправление функции dynamic_upsert_entity\n');

    console.log('1️⃣ Удаление старой функции...');
    await sql`DROP FUNCTION IF EXISTS dynamic_upsert_entity(TEXT, TEXT, JSONB) CASCADE`;
    console.log('   ✓ Удалена\n');

    console.log('2️⃣ Создание исправленной функции...');
    await sql.unsafe(`
      CREATE OR REPLACE FUNCTION dynamic_upsert_entity(
        p_table_name TEXT,
        p_rentprog_id TEXT,
        p_data JSONB
      )
      RETURNS TABLE(entity_id UUID, created BOOLEAN, added_columns TEXT[]) AS $$
      DECLARE
        v_entity_id UUID;
        v_created BOOLEAN := FALSE;
        v_added_columns TEXT[] := '{}';
        v_existing_columns TEXT[];
        v_column_name TEXT;
        v_insert_cols TEXT := 'id';
        v_insert_vals TEXT := 'gen_random_uuid()';
        v_update_set TEXT := '';
        v_first_update BOOLEAN := TRUE;
        v_entity_type TEXT;
      BEGIN
        -- Определяем entity_type из table_name
        v_entity_type := CASE
          WHEN p_table_name = 'cars' THEN 'car'
          WHEN p_table_name = 'clients' THEN 'client'
          WHEN p_table_name = 'bookings' THEN 'booking'
          ELSE rtrim(p_table_name, 's')
        END;

        -- 1. Ищем существующую запись в external_refs
        SELECT er.entity_id INTO v_entity_id
        FROM external_refs er
        WHERE er.system = 'rentprog'
          AND er.external_id = p_rentprog_id
          AND er.entity_type = v_entity_type
        LIMIT 1;

        IF v_entity_id IS NULL THEN
          -- Создаем новую запись
          v_entity_id := gen_random_uuid();
          v_created := TRUE;

          -- КРИТИЧНО: Сохраняем p_data в external_refs.data
          INSERT INTO external_refs (entity_type, entity_id, system, external_id, data)
          VALUES (
            v_entity_type,
            v_entity_id,
            'rentprog',
            p_rentprog_id,
            p_data  -- ← ВОТ ОНО!
          );

          RAISE NOTICE 'Created new entity % with full data', v_entity_id;
        ELSE
          -- Обновляем существующую запись
          UPDATE external_refs
          SET 
            data = p_data,  -- ← И ЗДЕСЬ!
            updated_at = NOW()
          WHERE entity_id = v_entity_id
            AND system = 'rentprog';

          RAISE NOTICE 'Updated entity % with full data', v_entity_id;
        END IF;

        -- 2. Получаем список существующих колонок в таблице
        SELECT array_agg(column_name::TEXT)
        INTO v_existing_columns
        FROM information_schema.columns
        WHERE table_name = p_table_name
          AND table_schema = 'public';

        -- 3. Обрабатываем каждое поле из p_data
        FOR v_column_name IN SELECT jsonb_object_keys(p_data)
        LOOP
          -- Пропускаем служебные поля
          IF v_column_name IN ('id', 'created_at', 'updated_at') THEN
            CONTINUE;
          END IF;

          -- Если колонки нет - добавляем
          IF NOT (v_column_name = ANY(v_existing_columns)) THEN
            BEGIN
              -- Определяем тип на основе JSONB типа
              EXECUTE format(
                'ALTER TABLE %I ADD COLUMN %I TEXT',
                p_table_name,
                v_column_name
              );
              v_added_columns := array_append(v_added_columns, v_column_name);
              RAISE NOTICE 'Added column %.%', p_table_name, v_column_name;
            EXCEPTION WHEN OTHERS THEN
              RAISE WARNING 'Failed to add column %: %', v_column_name, SQLERRM;
            END;
          END IF;
        END LOOP;

        -- 4. Вставка или обновление в основной таблице
        IF v_created THEN
          -- INSERT с data (триггер обработает)
          EXECUTE format(
            'INSERT INTO %I (id, data) VALUES ($1, $2::jsonb) RETURNING id',
            p_table_name
          ) USING v_entity_id, p_data;
        ELSE
          -- UPDATE с data (триггер обработает)
          EXECUTE format(
            'UPDATE %I SET data = $2::jsonb, updated_at = NOW() WHERE id = $1',
            p_table_name
          ) USING v_entity_id, p_data;
        END IF;

        RETURN QUERY SELECT v_entity_id, v_created, v_added_columns;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('   ✓ Функция создана\n');

    console.log('3️⃣ Тестирование функции...');
    const testResult = await sql`
      SELECT * FROM dynamic_upsert_entity(
        'bookings',
        'test_payload_' || gen_random_uuid()::text,
        '{"test_field": "test_value", "payload_json": {"car": {"id": 999, "model": "Test Car"}, "client": {"id": 888, "name": "Test Client"}}}'::jsonb
      )
    `;

    console.log('   Результат:');
    console.log('   entity_id:', testResult[0].entity_id);
    console.log('   created:', testResult[0].created);
    console.log('   added_columns:', testResult[0].added_columns);

    // Проверяем external_refs
    const refCheck = await sql`
      SELECT 
        external_id,
        jsonb_typeof(data) as data_type,
        pg_column_size(data) as data_size,
        data
      FROM external_refs
      WHERE entity_id = ${testResult[0].entity_id}
    `;

    if (refCheck.length > 0) {
      console.log('\n   ✅ External ref:');
      console.log('      external_id:', refCheck[0].external_id);
      console.log('      data type:', refCheck[0].data_type);
      console.log('      data size:', refCheck[0].data_size, 'bytes');
      if (refCheck[0].data) {
        console.log('      data содержит payload_json:', refCheck[0].data.payload_json !== undefined);
        console.log('      data.payload_json:', JSON.stringify(refCheck[0].data.payload_json));
      }
    }

    // Удаляем тестовую запись
    await sql`DELETE FROM bookings WHERE id = ${testResult[0].entity_id}`;
    await sql`DELETE FROM external_refs WHERE entity_id = ${testResult[0].entity_id}`;
    console.log('\n   🧹 Тестовая запись удалена');

    console.log('\n✅ ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!');
    console.log('\n📋 Что изменилось:');
    console.log('   • INSERT INTO external_refs теперь включает: data = p_data');
    console.log('   • UPDATE external_refs теперь обновляет: data = p_data');
    console.log('   • Полный payload с car/client данными теперь сохраняется!');

  } finally {
    await sql.end();
  }
}

fixFunction().catch(console.error);

