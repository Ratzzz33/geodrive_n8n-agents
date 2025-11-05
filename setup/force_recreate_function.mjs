import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function forceRecreateFunction() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n🔧 Форсированное пересоздание dynamic_upsert_entity...\n');

  try {
    // 1. Удалить все версии функции
    console.log('1️⃣ Удаление всех версий функции...');
    await sql.unsafe(`DROP FUNCTION IF EXISTS dynamic_upsert_entity(TEXT, TEXT, JSONB) CASCADE;`);
    console.log('   ✓ Функция удалена\n');

    // 2. Создать заново с правильным external_id
    console.log('2️⃣ Создание новой функции...');
    await sql.unsafe(`
      CREATE FUNCTION dynamic_upsert_entity(
          p_table_name TEXT,
          p_rentprog_id TEXT,
          p_data JSONB
      )
      RETURNS TABLE(entity_id UUID, created BOOLEAN, added_columns TEXT[]) AS $$
      DECLARE
          v_entity_id UUID;
          v_created BOOLEAN := FALSE;
          v_column_name TEXT;
          v_column_type TEXT;
          v_sql TEXT;
          v_added_columns TEXT[] := ARRAY[]::TEXT[];
          v_key TEXT;
          v_value_type TEXT;
          v_set_clause TEXT := '';
          v_first_set_item BOOLEAN := TRUE;
      BEGIN
          -- 1. Найти или создать запись в external_refs
          SELECT er.entity_id INTO v_entity_id
          FROM external_refs er
          WHERE er.system = 'rentprog' AND er.external_id = p_rentprog_id;

          IF v_entity_id IS NULL THEN
              v_entity_id := gen_random_uuid();
              -- ВАЖНО: external_id = p_rentprog_id (НЕ NULL!)
              INSERT INTO external_refs (entity_type, entity_id, system, external_id, data)
              VALUES (p_table_name, v_entity_id, 'rentprog', p_rentprog_id, p_data);
              v_created := TRUE;
              RAISE NOTICE 'Created external_ref: entity_id=%, external_id=%', v_entity_id, p_rentprog_id;
          ELSE
              -- Обновляем data в external_refs
              UPDATE external_refs er
              SET
                  data = p_data,
                  updated_at = NOW()
              WHERE er.entity_id = v_entity_id
              AND er.system = 'rentprog';
              RAISE NOTICE 'Updated external_ref: entity_id=%, external_id=%', v_entity_id, p_rentprog_id;
          END IF;

          -- 2. Динамически добавлять колонки в целевую таблицу
          FOR v_key, v_value_type IN SELECT key, jsonb_typeof(value) FROM jsonb_each(p_data)
          LOOP
              -- Пропускаем служебные поля и foreign keys
              IF v_key IN ('id', 'created_at', 'updated_at', 'car_id', 'client_id', 'booking_id') THEN
                  CONTINUE;
              END IF;

              -- Определяем тип колонки
              IF v_value_type = 'string' THEN
                  v_column_type := 'TEXT';
              ELSIF v_value_type = 'number' THEN
                  IF p_data->>v_key LIKE '%.%' THEN
                      v_column_type := 'NUMERIC';
                  ELSE
                      v_column_type := 'BIGINT';
                  END IF;
              ELSIF v_value_type = 'boolean' THEN
                  v_column_type := 'BOOLEAN';
              ELSIF v_value_type = 'array' THEN
                  v_column_type := 'JSONB';
              ELSIF v_value_type = 'object' THEN
                  v_column_type := 'JSONB';
              ELSE
                  v_column_type := 'TEXT';
              END IF;

              -- Проверяем существование колонки
              PERFORM 1
              FROM information_schema.columns
              WHERE table_name = p_table_name AND column_name = v_key;

              IF NOT FOUND THEN
                  v_sql := format('ALTER TABLE %I ADD COLUMN %I %s', p_table_name, v_key, v_column_type);
                  EXECUTE v_sql;
                  v_added_columns := array_append(v_added_columns, format('%s (%s)', v_key, v_column_type));
                  RAISE NOTICE 'Added column: %.% (%).', p_table_name, v_key, v_column_type;
              END IF;
          END LOOP;

          -- 3. Вставить или обновить данные в целевой таблице
          v_sql := format(
              'INSERT INTO %I (id) VALUES ($1) ON CONFLICT (id) DO NOTHING',
              p_table_name
          );
          EXECUTE v_sql USING v_entity_id;

          -- Обновляем основную таблицу (динамически)
          FOR v_key IN SELECT jsonb_object_keys(p_data)
          LOOP
              -- Пропускаем служебные поля и foreign keys
              IF v_key IN ('id', 'created_at', 'updated_at', 'car_id', 'client_id', 'booking_id') THEN
                  CONTINUE;
              END IF;

              IF NOT v_first_set_item THEN
                  v_set_clause := v_set_clause || ', ';
              END IF;
              v_set_clause := v_set_clause || format('%I = %L', v_key, p_data->>v_key);
              v_first_set_item := FALSE;
          END LOOP;

          IF v_set_clause != '' THEN
              v_sql := format(
                  'UPDATE %I SET %s, updated_at = NOW() WHERE id = $1',
                  p_table_name,
                  v_set_clause
              );
              EXECUTE v_sql USING v_entity_id;
          END IF;

          RETURN QUERY SELECT v_entity_id, v_created, v_added_columns;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('   ✓ Функция создана с RAISE NOTICE для отладки\n');

    // 3. Проверка
    console.log('3️⃣ Проверка функции...');
    const result = await sql`
      SELECT proname, pronargs, pg_get_function_arguments(oid) as args
      FROM pg_proc
      WHERE proname = 'dynamic_upsert_entity';
    `;
    console.log(`   ✓ Функция найдена: ${result[0].proname}(${result[0].args})`);
    console.log(`   ✓ Количество аргументов: ${result[0].pronargs}\n`);

    console.log('✅ Функция успешно пересоздана!\n');
    console.log('💡 Добавлены RAISE NOTICE для отладки INSERT в external_refs\n');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

forceRecreateFunction();

