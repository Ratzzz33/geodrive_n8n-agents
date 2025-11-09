-- Миграция: Исправление dynamic_upsert_entity для обработки integer[] → jsonb
-- Дата: 2025-11-09
-- Цель: Предотвратить ошибку "column price_values is of type jsonb but expression is of type integer[]"

-- Сначала удаляем старую функцию
DROP FUNCTION IF EXISTS dynamic_upsert_entity(TEXT, TEXT, JSONB);

-- Создаём обновлённую версию
CREATE OR REPLACE FUNCTION dynamic_upsert_entity(
  table_name TEXT,
  rentprog_id TEXT,
  data JSONB
) RETURNS TABLE(entity_id UUID, created BOOLEAN, entity_type TEXT) AS $$
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
BEGIN
  -- Проверяем существование записи
  EXECUTE format('SELECT id FROM %I WHERE rentprog_id = $1', table_name)
  INTO new_id
  USING rentprog_id;

  is_new := (new_id IS NULL);

  IF is_new THEN
    new_id := gen_random_uuid();
  END IF;

  -- Обрабатываем каждое поле из JSON
  FOR key, value IN SELECT * FROM jsonb_each_text(data)
  LOOP
    -- Проверяем существование колонки
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = dynamic_upsert_entity.table_name
        AND column_name = key
    ) INTO exists_flag;

    -- Если колонка не существует - создаём
    IF NOT exists_flag THEN
      -- Пытаемся определить тип из JSON
      BEGIN
        -- Проверяем, является ли значение массивом в оригинальном JSON
        IF jsonb_typeof(data->key) = 'array' THEN
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

      -- Создаём колонку
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS %I %s', 
        table_name, key, column_type);
    END IF;

    -- Получаем реальный тип колонки
    SELECT data_type INTO column_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = dynamic_upsert_entity.table_name
      AND column_name = key;

    -- Формируем списки для INSERT/UPDATE
    column_list := column_list || format('%I, ', key);
    
    -- Преобразуем значение в зависимости от типа колонки и типа данных
    IF column_type = 'jsonb' THEN
      -- Если колонка JSONB, нужно правильно преобразовать значение
      IF jsonb_typeof(data->key) = 'array' THEN
        -- Если в JSON массив - используем как есть
        value_list := value_list || format('%L::jsonb, ', data->key);
        update_list := update_list || format('%I = %L::jsonb, ', key, data->key);
      ELSE
        -- Если в JSON не массив, но колонка JSONB - оборачиваем в кавычки
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
    sql_query := format(
      'INSERT INTO %I (id, rentprog_id, %s, created_at, updated_at) VALUES (%L, %L, %s, NOW(), NOW())',
      table_name, column_list, new_id, rentprog_id, value_list
    );
  ELSE
    -- UPDATE
    sql_query := format(
      'UPDATE %I SET %s, updated_at = NOW() WHERE id = %L',
      table_name, update_list, new_id
    );
  END IF;

  RAISE NOTICE 'SQL: %', sql_query;
  EXECUTE sql_query;

  RETURN QUERY SELECT new_id, is_new, table_name;
END;
$$ LANGUAGE plpgsql;

-- Комментарий для миграции
COMMENT ON FUNCTION dynamic_upsert_entity IS 
'Обновлено 2025-11-09: Добавлена поддержка преобразования массивов в JSONB';

