-- =====================================================
-- Migration: 0043_fix_null_string_in_dynamic_upsert.sql
-- Описание: Исправление фильтрации строки "null" в dynamic_upsert_entity
-- Дата: 2025-01-21
-- =====================================================

-- Удаляем старую версию функции
DROP FUNCTION IF EXISTS dynamic_upsert_entity(TEXT, TEXT, JSONB);

-- Создаем исправленную функцию с защитой от строки "null"
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
    v_value_text TEXT;
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

    -- 3. Вставить или обновить данные в целевой таблице
    v_sql := format(
        'INSERT INTO %I (id) VALUES ($1) ON CONFLICT (id) DO NOTHING',
        p_table_name
    );
    EXECUTE v_sql USING v_entity_id;

    -- 4. Обновляем основную таблицу (динамически)
    -- КРИТИЧНО: Пропускаем NULL, пустые строки и строку "null"
    FOR v_key IN SELECT jsonb_object_keys(p_data)
    LOOP
        -- Пропускаем служебные поля и foreign keys
        IF v_key IN ('id', 'created_at', 'updated_at', 'car_id', 'client_id', 'booking_id') THEN
            CONTINUE;
        END IF;

        -- ИСПРАВЛЕНИЕ: Извлекаем значение как текст и проверяем на NULL/пустоту/строку "null"
        v_value_text := p_data->>v_key;
        
        -- Пропускаем NULL, пустые строки и строку "null" (чтобы не затереть существующие данные)
        IF v_value_text IS NULL OR v_value_text = '' OR LOWER(TRIM(v_value_text)) = 'null' THEN
            CONTINUE;
        END IF;

        -- Добавляем поле в SET clause только если значение не NULL, не пустое и не строка "null"
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

