#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('📝 Исправляем обработку unique constraint (branch, number)...');
  
  await sql`DROP FUNCTION IF EXISTS dynamic_upsert_entity(text, text, jsonb)`;
  
  await sql`
    CREATE FUNCTION public.dynamic_upsert_entity(
      p_table_name text, 
      p_rentprog_id text, 
      p_data jsonb
    )
    RETURNS TABLE(entity_id uuid, created boolean, entity_type text)
    LANGUAGE plpgsql
    AS $$
    DECLARE
      key TEXT;
      value TEXT;
      column_type TEXT;
      exists_flag BOOLEAN;
      new_id UUID;
      is_new BOOLEAN;
      column_list TEXT := '';
      value_list TEXT := '';
      update_list TEXT := '';
      sql_query TEXT;
      jsonb_value JSONB;
      branch_value TEXT;
    BEGIN
      -- Извлекаем branch из data для external_refs
      branch_value := p_data->>'branch';
      
      -- Проверяем существование записи по rentprog_id
      EXECUTE format('SELECT id FROM %I WHERE rentprog_id = $1', p_table_name)
      INTO new_id
      USING p_rentprog_id;

      -- Если не нашли по rentprog_id, проверяем по (branch, number) для bookings
      IF new_id IS NULL AND p_table_name = 'bookings' THEN
        EXECUTE format('SELECT id FROM %I WHERE branch = $1 AND number = $2', p_table_name)
        INTO new_id
        USING branch_value, (p_data->>'number')::INTEGER;
      END IF;

      is_new := (new_id IS NULL);

      IF is_new THEN
        new_id := gen_random_uuid();
      END IF;

      -- Обрабатываем каждое поле из JSON
      FOR key, value IN SELECT * FROM jsonb_each_text(p_data)
      LOOP
        -- Пропускаем системные поля
        IF key IN ('id', 'rentprog_id', 'created_at', 'updated_at') THEN
          CONTINUE;
        END IF;
        
        -- Пропускаем UUID foreign key колонки
        IF key LIKE '%_id' AND key != 'rentprog_id' THEN
          CONTINUE;
        END IF;
        
        -- Проверяем существование колонки
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = p_table_name
            AND column_name = key
        ) INTO exists_flag;

        -- Если колонка не существует - создаём
        IF NOT exists_flag THEN
          BEGIN
            IF jsonb_typeof(p_data->key) = 'array' THEN
              column_type := 'JSONB';
            ELSIF value ~ '^-?\d+$' THEN
              column_type := 'INTEGER';
            ELSIF value ~ '^-?\d+\.\d+$' THEN
              column_type := 'NUMERIC';
            ELSIF value ~ '^\d{4}-\d{2}-\d{2}' THEN
              column_type := 'TIMESTAMPTZ';
            ELSIF value = 'true' OR value = 'false' THEN
              column_type := 'BOOLEAN';
            ELSE
              column_type := 'TEXT';
            END IF;
          EXCEPTION
            WHEN OTHERS THEN
              column_type := 'TEXT';
          END;

          EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS %I %s', 
            p_table_name, key, column_type);
        END IF;

        -- Получаем реальный тип колонки
        SELECT data_type INTO column_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = p_table_name
          AND column_name = key;

        -- Формируем списки для INSERT/UPDATE
        column_list := column_list || format('%I, ', key);
        
        IF column_type = 'jsonb' THEN
          IF jsonb_typeof(p_data->key) = 'array' THEN
            value_list := value_list || format('%L::jsonb, ', p_data->key);
            update_list := update_list || format('%I = %L::jsonb, ', key, p_data->key);
          ELSE
            value_list := value_list || format('to_jsonb(%L::text), ', value);
            update_list := update_list || format('%I = to_jsonb(%L::text), ', key, value);
          END IF;
        ELSIF value IS NULL OR value = 'null' THEN
          value_list := value_list || 'NULL, ';
          update_list := update_list || format('%I = NULL, ', key);
        ELSIF column_type IN ('integer', 'bigint', 'smallint') THEN
          value_list := value_list || format('%L::INTEGER, ', value);
          update_list := update_list || format('%I = %L::INTEGER, ', key, value);
        ELSIF column_type IN ('numeric', 'decimal', 'real', 'double precision') THEN
          value_list := value_list || format('%L::NUMERIC, ', value);
          update_list := update_list || format('%I = %L::NUMERIC, ', key, value);
        ELSIF column_type IN ('timestamp with time zone', 'timestamp without time zone', 'date') THEN
          value_list := value_list || format('%L::TIMESTAMPTZ, ', value);
          update_list := update_list || format('%I = %L::TIMESTAMPTZ, ', key, value);
        ELSIF column_type = 'boolean' THEN
          value_list := value_list || format('%L::BOOLEAN, ', value);
          update_list := update_list || format('%I = %L::BOOLEAN, ', key, value);
        ELSE
          value_list := value_list || format('%L, ', value);
          update_list := update_list || format('%I = %L, ', key, value);
        END IF;
      END LOOP;

      -- Удаляем последние запятые
      column_list := rtrim(column_list, ', ');
      value_list := rtrim(value_list, ', ');
      update_list := rtrim(update_list, ', ');

      IF is_new THEN
        -- INSERT
        IF column_list = '' THEN
          sql_query := format(
            'INSERT INTO %I (id, rentprog_id, created_at, updated_at) VALUES (%L, %L, NOW(), NOW())',
            p_table_name, new_id, p_rentprog_id
          );
        ELSE
          sql_query := format(
            'INSERT INTO %I (id, rentprog_id, %s, created_at, updated_at) VALUES (%L, %L, %s, NOW(), NOW())',
            p_table_name, column_list, new_id, p_rentprog_id, value_list
          );
        END IF;
      ELSE
        -- UPDATE
        IF update_list = '' THEN
          sql_query := format(
            'UPDATE %I SET rentprog_id = %L, updated_at = NOW() WHERE id = %L',
            p_table_name, p_rentprog_id, new_id
          );
        ELSE
          sql_query := format(
            'UPDATE %I SET rentprog_id = %L, %s, updated_at = NOW() WHERE id = %L',
            p_table_name, p_rentprog_id, update_list, new_id
          );
        END IF;
      END IF;

      RAISE NOTICE 'SQL: %', sql_query;
      EXECUTE sql_query;

      -- Создаём/обновляем запись в external_refs
      INSERT INTO external_refs (
        entity_type,
        entity_id,
        system,
        external_id,
        branch_code,
        data,
        created_at,
        updated_at
      ) VALUES (
        p_table_name,
        new_id,
        'rentprog',
        p_rentprog_id,
        branch_value,
        p_data,
        NOW(),
        NOW()
      )
      ON CONFLICT (system, external_id) DO UPDATE SET
        entity_id = EXCLUDED.entity_id,
        branch_code = EXCLUDED.branch_code,
        data = EXCLUDED.data,
        updated_at = NOW();

      RETURN QUERY SELECT new_id, is_new, p_table_name;
    END;
    $$;
  `;
  
  console.log('✅ Функция исправлена');
  console.log('   - Проверка по rentprog_id');
  console.log('   - Fallback проверка по (branch, number) для bookings');
  console.log('   - Избегаем duplicate key errors');
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  console.error(error);
  process.exit(1);
} finally {
  await sql.end();
}

