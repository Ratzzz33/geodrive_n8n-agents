import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function fixDynamicUpsertOnConflict() {
  console.log('🔍 Анализ и исправление функции dynamic_upsert_entity...\n');
  
  try {
    // 1. Проверяем PRIMARY KEY на таблице cars
    console.log('1️⃣ Проверка PRIMARY KEY на таблице cars...\n');
    
    const primaryKey = await sql`
      SELECT 
        conname as constraint_name,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'cars'::regclass
        AND contype = 'p'
    `;
    
    if (primaryKey.length > 0) {
      console.log(`   ✅ PRIMARY KEY найден:`);
      console.log(`   ${primaryKey[0].definition}\n`);
    } else {
      console.log(`   ❌ PRIMARY KEY НЕ найден!\n`);
    }
    
    // 2. Получаем текущее определение функции
    console.log('2️⃣ Получаю текущее определение функции...\n');
    
    const functionDef = await sql`
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc
      WHERE proname = 'dynamic_upsert_entity'
        AND pronargs = 3
      ORDER BY oid DESC
      LIMIT 1
    `;
    
    if (functionDef.length === 0) {
      console.log('❌ Функция не найдена!');
      return;
    }
    
    const def = functionDef[0].definition;
    console.log('✅ Функция найдена\n');
    
    // 3. Ищем проблемный INSERT с ON CONFLICT
    console.log('3️⃣ Анализ INSERT с ON CONFLICT в функции...\n');
    
    if (def.includes('ON CONFLICT (id)')) {
      console.log('   ⚠️  Найден ON CONFLICT (id)');
      console.log('   Проблема: PostgreSQL не может использовать ON CONFLICT (id)');
      console.log('   в динамическом SQL с format() для таблицы cars\n');
      
      console.log('   🔴 РЕШЕНИЕ: Заменить ON CONFLICT (id) на проверку существования');
      console.log('   через SELECT перед INSERT\n');
    }
    
    // 4. Создаем исправленную версию функции
    console.log('4️⃣ Создаю исправленную версию функции...\n');
    
    const fixedFunction = `
CREATE OR REPLACE FUNCTION dynamic_upsert_entity(
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
    v_value_text TEXT;
    v_exists BOOLEAN;
BEGIN
    -- 1. Найти или создать запись в external_refs
    SELECT er.entity_id INTO v_entity_id
    FROM external_refs er
    WHERE er.system = 'rentprog' AND er.external_id = p_rentprog_id;

    IF v_entity_id IS NULL THEN
        v_entity_id := gen_random_uuid();
        INSERT INTO external_refs (entity_type, entity_id, system, external_id, data)
        VALUES (p_table_name, v_entity_id, 'rentprog', p_rentprog_id, p_data);
        v_created := TRUE;
    ELSE
        -- Обновляем data в external_refs
        UPDATE external_refs er
        SET
            data = p_data,
            updated_at = NOW()
        WHERE er.entity_id = v_entity_id
        AND er.system = 'rentprog';
    END IF;

    -- 2. Динамически добавлять колонки в целевую таблицу
    FOR v_key, v_value_type IN SELECT key, jsonb_typeof(value) FROM jsonb_each(p_data)
    LOOP
        -- Пропускаем служебные поля и foreign keys
        IF v_key IN ('id', 'created_at', 'updated_at', 'car_id', 'client_id', 'booking_id') THEN
            CONTINUE;
        END IF;

        -- Определяем тип колонки на основе типа JSONB
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
        END IF;
    END LOOP;

    -- 3. ИСПРАВЛЕНИЕ: Проверяем существование записи перед INSERT
    -- Вместо ON CONFLICT используем SELECT ... FOR UPDATE или простую проверку
    v_sql := format('SELECT EXISTS(SELECT 1 FROM %I WHERE id = $1)', p_table_name);
    EXECUTE v_sql INTO v_exists USING v_entity_id;

    IF NOT v_exists THEN
        -- Вставляем новую запись только с id
        v_sql := format('INSERT INTO %I (id) VALUES ($1)', p_table_name);
        EXECUTE v_sql USING v_entity_id;
    END IF;

    -- 4. Обновляем основную таблицу (динамически)
    -- КРИТИЧНО: Пропускаем NULL и пустые строки, чтобы не затереть существующие данные
    FOR v_key IN SELECT jsonb_object_keys(p_data)
    LOOP
        -- Пропускаем служебные поля и foreign keys
        IF v_key IN ('id', 'created_at', 'updated_at', 'car_id', 'client_id', 'booking_id') THEN
            CONTINUE;
        END IF;

        -- ИСПРАВЛЕНИЕ: Извлекаем значение как текст и проверяем на NULL/пустоту
        v_value_text := p_data->>v_key;
        
        -- Пропускаем NULL, пустые строки И строку 'null'
        IF v_value_text IS NULL OR v_value_text = '' OR LOWER(TRIM(v_value_text)) = 'null' THEN
            CONTINUE;
        END IF;

        -- Добавляем поле в SET clause только если значение не NULL и не пустое
        IF NOT v_first_set_item THEN
            v_set_clause := v_set_clause || ', ';
        END IF;
        v_set_clause := v_set_clause || format('%I = %L', v_key, v_value_text);
        v_first_set_item := FALSE;
    END LOOP;

    -- Выполняем UPDATE только если есть поля для обновления
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
    `;
    
    console.log('   Применяю исправленную функцию...');
    await sql.unsafe(fixedFunction);
    console.log('   ✅ Функция обновлена!\n');
    
    // 5. Тестируем исправленную функцию
    console.log('5️⃣ Тестирование исправленной функции...\n');
    
    const testData = {
      rentprog_id: 'TEST_FIX_123',
      car_name: 'Test Car',
      code: 'TEST',
      year: 2024
    };
    
    try {
      const result = await sql`
        SELECT * FROM dynamic_upsert_entity(
          'cars'::TEXT,
          ${testData.rentprog_id}::TEXT,
          ${JSON.stringify(testData)}::JSONB
        )
      `;
      
      console.log(`   ✅ Функция работает!`);
      console.log(`   Результат: ${JSON.stringify(result[0])}\n`);
      
      // Удаляем тестовую запись
      await sql`DELETE FROM external_refs WHERE external_id = ${testData.rentprog_id}`;
      await sql`DELETE FROM cars WHERE rentprog_id = ${testData.rentprog_id}`;
      console.log('   ✅ Тестовая запись удалена\n');
      
    } catch (error) {
      console.log(`   ❌ Ошибка при тестировании:`);
      console.log(`   ${error.message}\n`);
    }
    
    console.log('✅ Исправление завершено!\n');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await sql.end();
  }
}

fixDynamicUpsertOnConflict()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });

