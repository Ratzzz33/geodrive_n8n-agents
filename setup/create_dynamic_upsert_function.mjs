import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function createDynamicUpsertFunction() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n📝 Создание функции для динамического upsert...\n');

  try {
    // Создаем функцию которая автоматически добавляет колонки и делает upsert
    await sql.unsafe(`
      CREATE OR REPLACE FUNCTION dynamic_upsert_entity(
        p_table_name TEXT,
        p_rentprog_id TEXT,
        p_data JSONB
      )
      RETURNS TABLE(entity_id UUID, created BOOLEAN, added_columns TEXT[]) AS $$
      DECLARE
        v_entity_id UUID;
        v_entity_type TEXT;
        v_key TEXT;
        v_value TEXT;
        v_pg_type TEXT;
        v_column_exists BOOLEAN;
        v_added_columns TEXT[] := ARRAY[]::TEXT[];
        v_created BOOLEAN := FALSE;
      BEGIN
        -- Определяем entity_type из table_name (cars -> car, clients -> client)
        v_entity_type := rtrim(p_table_name, 's');
        
        -- Проходим по всем ключам в JSON
        FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_data)
        LOOP
          -- Пропускаем служебные поля
          IF v_key IN ('id') THEN
            CONTINUE;
          END IF;
          
          -- Проверяем существует ли колонка
          SELECT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = p_table_name 
            AND column_name = v_key
          ) INTO v_column_exists;
          
          -- Если колонки нет - добавляем
          IF NOT v_column_exists THEN
            -- Определяем тип данных
            CASE 
              WHEN v_value ~ '^-?\\d+$' THEN v_pg_type := 'INTEGER';
              WHEN v_value ~ '^-?\\d+\\.\\d+$' THEN v_pg_type := 'NUMERIC';
              WHEN v_value IN ('true', 'false', 't', 'f') THEN v_pg_type := 'BOOLEAN';
              WHEN v_value ~ '^\\d{4}-\\d{2}-\\d{2}T' THEN v_pg_type := 'TIMESTAMPTZ';
              WHEN v_value ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN v_pg_type := 'DATE';
              WHEN v_value ~ '^[\\[\\{]' THEN v_pg_type := 'JSONB';
              ELSE v_pg_type := 'TEXT';
            END CASE;
            
            -- Добавляем колонку
            BEGIN
              EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS %I %s', 
                             p_table_name, v_key, v_pg_type);
              v_added_columns := array_append(v_added_columns, v_key || ' (' || v_pg_type || ')');
              RAISE NOTICE 'Added column: %.% (%)', p_table_name, v_key, v_pg_type;
            EXCEPTION WHEN OTHERS THEN
              RAISE WARNING 'Failed to add column %: %', v_key, SQLERRM;
            END;
          END IF;
        END LOOP;
        
        -- Ищем entity_id через external_refs
        SELECT er.entity_id INTO v_entity_id
        FROM external_refs er
        WHERE er.system = 'rentprog'
        AND er.external_id = p_rentprog_id
        AND er.entity_type = v_entity_type
        LIMIT 1;
        
        -- Если не найден - создаем новый
        IF v_entity_id IS NULL THEN
          v_entity_id := gen_random_uuid();
          v_created := TRUE;
          
          -- Создаем запись в external_refs
          INSERT INTO external_refs (
            entity_type,
            entity_id,
            system,
            external_id,
            data
          ) VALUES (
            v_entity_type,
            v_entity_id,
            'rentprog',
            p_rentprog_id,
            p_data
          );
          
          -- Создаем запись в основной таблице (динамически)
          EXECUTE format(
            'INSERT INTO %I (id) VALUES ($1) ON CONFLICT (id) DO NOTHING',
            p_table_name
          ) USING v_entity_id;
        END IF;
        
        -- Обновляем data в external_refs
        UPDATE external_refs er
        SET 
          data = p_data,
          updated_at = NOW()
        WHERE er.entity_id = v_entity_id
        AND er.system = 'rentprog';
        
        -- Обновляем основную таблицу (динамически)
        -- Строим SET clause из всех полей в JSON
        DECLARE
          v_set_clause TEXT := '';
          v_first BOOLEAN := TRUE;
        BEGIN
          FOR v_key IN SELECT jsonb_object_keys(p_data)
          LOOP
            IF v_key != 'id' THEN
              IF NOT v_first THEN
                v_set_clause := v_set_clause || ', ';
              END IF;
              v_set_clause := v_set_clause || format('%I = ($1->>%L)::%s', 
                v_key, v_key, 
                (SELECT data_type FROM information_schema.columns 
                 WHERE table_name = p_table_name AND column_name = v_key LIMIT 1)
              );
              v_first := FALSE;
            END IF;
          END LOOP;
          
          IF v_set_clause != '' THEN
            EXECUTE format(
              'UPDATE %I SET %s, updated_at = NOW() WHERE id = $2',
              p_table_name, v_set_clause
            ) USING p_data, v_entity_id;
          END IF;
        END;
        
        -- Возвращаем результат
        RETURN QUERY SELECT v_entity_id, v_created, v_added_columns;
      END;
      $$ LANGUAGE plpgsql;
    `);

    console.log('✅ Функция dynamic_upsert_entity создана!');
    
    console.log('\n💡 Использование в n8n (Postgres node):');
    console.log('   SELECT * FROM dynamic_upsert_entity(');
    console.log('     $1::TEXT,  -- table_name (cars/clients/bookings)');
    console.log('     $2::TEXT,  -- rentprog_id');
    console.log('     $3::JSONB  -- data');
    console.log('   );');
    
    console.log('\n🧪 Тестирование функции...');
    
    const testData = {
      id: 381296,
      name: 'Test1111',
      lastname: 'Test',
      phone: '0000009998',
      test_new_field: 'Это новое поле!'
    };
    
    const result = await sql`
      SELECT * FROM dynamic_upsert_entity(
        'clients',
        '381296',
        ${sql.json(testData)}
      );
    `;
    
    console.log('\n📊 Результат теста:');
    console.log('   Entity ID:', result[0].entity_id);
    console.log('   Created:', result[0].created);
    console.log('   Added columns:', result[0].added_columns);

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

createDynamicUpsertFunction();

