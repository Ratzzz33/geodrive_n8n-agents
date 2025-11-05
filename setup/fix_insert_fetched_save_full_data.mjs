#!/usr/bin/env node
/**
 * Исправление ноды Insert Fetched Entity:
 * Сохранять ПОЛНЫЕ данные (включая вложенные car/client) в поле data
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function updateFunction() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n🔧 Обновление dynamic_upsert_entity для сохранения полных данных...\n');

  try {
    // Обновляем функцию чтобы она НЕ исключала вложенные объекты
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
        v_sep TEXT := '';
      BEGIN
        -- Проверяем, существует ли сущность
        EXECUTE format('SELECT entity_id FROM external_refs WHERE system = $1 AND external_id = $2 AND entity_type = $3')
        INTO v_entity_id
        USING 'rentprog', p_rentprog_id, 
              CASE 
                WHEN p_table_name = 'cars' THEN 'car'
                WHEN p_table_name = 'clients' THEN 'client'
                WHEN p_table_name = 'bookings' THEN 'booking'
              END;

        IF v_entity_id IS NULL THEN
          -- Создаём новую сущность
          v_entity_id := gen_random_uuid();
          v_created := TRUE;

          -- Всегда добавляем поле data
          v_insert_cols := v_insert_cols || ', data';
          v_insert_vals := v_insert_vals || ', $1::jsonb';

          -- INSERT с полными данными
          EXECUTE format('INSERT INTO %I (%s) VALUES (%s) RETURNING id', 
            p_table_name, v_insert_cols, v_insert_vals)
          INTO v_entity_id
          USING p_data;

          -- Создаём external_ref
          INSERT INTO external_refs (entity_type, entity_id, system, external_id)
          VALUES (
            CASE 
              WHEN p_table_name = 'cars' THEN 'car'
              WHEN p_table_name = 'clients' THEN 'client'
              WHEN p_table_name = 'bookings' THEN 'booking'
            END,
            v_entity_id,
            'rentprog',
            p_rentprog_id
          );

          RAISE NOTICE 'Created new entity % with full data', v_entity_id;
        ELSE
          -- Обновляем существующую сущность
          v_created := FALSE;

          -- Обновляем только поле data целиком
          EXECUTE format('UPDATE %I SET data = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            p_table_name)
          USING p_data, v_entity_id;

          RAISE NOTICE 'Updated entity % with full data', v_entity_id;
        END IF;

        RETURN QUERY SELECT v_entity_id, v_created, v_added_columns;
      END;
      $$ LANGUAGE plpgsql;
    `);

    console.log('✅ Функция обновлена!');
    console.log('\n📝 Теперь dynamic_upsert_entity сохраняет:');
    console.log('   - ВСЕ данные из RentProg (включая car, client, counts, prolongs)');
    console.log('   - В поле data как JSONB');
    console.log('   - Триггер сможет извлечь car и client из data\n');

  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

updateFunction();

