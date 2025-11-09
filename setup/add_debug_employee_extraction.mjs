#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function addDebug() {
  const sql = postgres(CONNECTION_STRING, {max: 1, ssl: {rejectUnauthorized: false}});
  
  console.log('\n🔧 Добавление DEBUG в начало триггера...\n');
  
  try {
    await sql.unsafe(`
      CREATE OR REPLACE FUNCTION process_booking_nested_entities()
      RETURNS TRIGGER AS $$
      DECLARE
        car_data JSONB;
        client_data JSONB;
        car_uuid UUID;
        client_uuid UUID;
        
        -- Employee extraction variables
        employee_fields JSONB := '{
          "responsible_id": "responsible",
          "manager_id": "manager"
        }'::jsonb;
        field_key TEXT;
        name_field TEXT;
        id_value TEXT;
        name_value TEXT;
        employee_uuid UUID;
        old_id TEXT;
        new_id TEXT;
        old_name TEXT;
        new_name TEXT;
        id_array JSONB;
        name_array JSONB;
      BEGIN
        -- ========== DEBUG START ==========
        RAISE NOTICE '🔍 TRIGGER START: NEW.id = %', NEW.id;
        RAISE NOTICE '🔍 NEW.data type: %', jsonb_typeof(NEW.data);
        RAISE NOTICE '🔍 NEW.data keys: %', (SELECT array_agg(key) FROM jsonb_object_keys(NEW.data) AS key);
        RAISE NOTICE '🔍 NEW.data content: %', NEW.data::text;
        
        IF NEW.data ? 'responsible_id' THEN
          RAISE NOTICE '✅ Found responsible_id in data: %', NEW.data->'responsible_id';
        ELSE
          RAISE NOTICE '❌ NO responsible_id in data!';
        END IF;
        
        IF NEW.data ? 'responsible' THEN
          RAISE NOTICE '✅ Found responsible in data: %', NEW.data->'responsible';
        ELSE
          RAISE NOTICE '❌ NO responsible in data!';
        END IF;
        -- ========== DEBUG END ==========
        
        -- ========== ОБРАБОТКА CAR ==========
        IF NEW.data ? 'car' THEN
          car_data := NEW.data->'car';
          IF car_data ? 'id' THEN
            SELECT entity_id INTO car_uuid
            FROM external_refs
            WHERE system = 'rentprog'
              AND entity_type = 'car'
              AND external_id = (car_data->>'id');
            
            IF car_uuid IS NOT NULL THEN
              NEW.car_id := car_uuid;
            END IF;
          END IF;
        END IF;

        -- ========== ОБРАБОТКА CLIENT ==========
        IF NEW.data ? 'client' THEN
          client_data := NEW.data->'client';
          IF client_data ? 'id' THEN
            SELECT entity_id INTO client_uuid
            FROM external_refs
            WHERE system = 'rentprog'
              AND entity_type = 'client'
              AND external_id = (client_data->>'id');
            
            IF client_uuid IS NOT NULL THEN
              NEW.client_id := client_uuid;
            END IF;
          END IF;
        END IF;

        -- ========== ОБРАБОТКА BOOKING FIELDS ==========
        IF NEW.data ? 'price' THEN
          NEW.price := (NEW.data->>'price')::NUMERIC;
        END IF;
        IF NEW.data ? 'state' THEN
          NEW.state := NEW.data->>'state';
        END IF;
        IF NEW.data ? 'issue_at' THEN
          NEW.issue_at := (NEW.data->>'issue_at')::TIMESTAMPTZ;
        END IF;
        IF NEW.data ? 'return_at' THEN
          NEW.return_at := (NEW.data->>'return_at')::TIMESTAMPTZ;
        END IF;

        -- ========== EMPLOYEE EXTRACTION LOGIC ==========
        RAISE NOTICE '🔍 Starting employee extraction loop...';
        
        FOR field_key, name_field IN SELECT * FROM jsonb_each_text(employee_fields)
        LOOP
          RAISE NOTICE '🔍 Processing field: % (name field: %)', field_key, name_field;
          
          -- Проверяем наличие поля в данных
          IF NOT (NEW.data ? field_key) THEN
            RAISE NOTICE '⚠️  Field % not found in data, skipping', field_key;
            CONTINUE;
          END IF;
          
          RAISE NOTICE '✅ Field % found in data', field_key;
          
          id_value := NEW.data->>field_key;
          name_value := NEW.data->>name_field;
          
          RAISE NOTICE '📊 Raw values: id_value=%, name_value=%', id_value, name_value;

          -- Проверяем является ли значение массивом
          IF jsonb_typeof(NEW.data->field_key) = 'array' THEN
            RAISE NOTICE '🔍 Field % is ARRAY', field_key;
            id_array := NEW.data->field_key;
            name_array := NEW.data->name_field;

            -- Извлекаем старое и новое значения
            old_id := id_array->>0;
            new_id := id_array->>1;
            
            IF jsonb_typeof(name_array) = 'array' THEN
              old_name := name_array->>0;
              new_name := name_array->>1;
            ELSE
              old_name := name_value;
              new_name := name_value;
            END IF;

            RAISE NOTICE '📊 Array values: old_id=%, new_id=%, old_name=%, new_name=%', 
              old_id, new_id, old_name, new_name;

            -- Обрабатываем старого сотрудника
            IF old_id IS NOT NULL AND old_id != 'null' AND old_id != '' THEN
              RAISE NOTICE '🔄 Processing old employee: %', old_id;
              
              SELECT entity_id INTO employee_uuid
              FROM external_refs
              WHERE system = 'rentprog'
                AND external_id = old_id
                AND entity_type = 'rentprog_employee';

              IF employee_uuid IS NOT NULL THEN
                RAISE NOTICE '✅ Old employee found: %', employee_uuid;
                IF old_name IS NOT NULL AND old_name != 'null' AND old_name != '' THEN
                  UPDATE rentprog_employees
                  SET
                    name = old_name,
                    updated_at = NOW()
                  WHERE id = employee_uuid
                    AND (name IS NULL OR name != old_name);
                  RAISE NOTICE '✅ Updated old employee name to: %', old_name;
                END IF;
              ELSE
                RAISE NOTICE '🆕 Creating old employee: %', old_id;
                employee_uuid := gen_random_uuid();
                INSERT INTO rentprog_employees (id, rentprog_id, name, data)
                VALUES (
                  employee_uuid,
                  old_id,
                  COALESCE(old_name, 'Employee ' || old_id),
                  jsonb_build_object('id', old_id, 'name', old_name, 'source_field', field_key)
                );
                INSERT INTO external_refs (entity_type, entity_id, system, external_id)
                VALUES ('rentprog_employee', employee_uuid, 'rentprog', old_id);
                RAISE NOTICE '✅ Created old employee: %', employee_uuid;
              END IF;
            END IF;

            -- Обрабатываем нового сотрудника
            IF new_id IS NOT NULL AND new_id != 'null' AND new_id != '' THEN
              RAISE NOTICE '🔄 Processing new employee: %', new_id;
              
              SELECT entity_id INTO employee_uuid
              FROM external_refs
              WHERE system = 'rentprog'
                AND external_id = new_id
                AND entity_type = 'rentprog_employee';

              IF employee_uuid IS NOT NULL THEN
                RAISE NOTICE '✅ New employee found: %', employee_uuid;
                IF new_name IS NOT NULL AND new_name != 'null' AND new_name != '' THEN
                  UPDATE rentprog_employees
                  SET
                    name = new_name,
                    updated_at = NOW()
                  WHERE id = employee_uuid
                    AND (name IS NULL OR name != new_name);
                  RAISE NOTICE '✅ Updated new employee name to: %', new_name;
                END IF;
              ELSE
                RAISE NOTICE '🆕 Creating new employee: %', new_id;
                employee_uuid := gen_random_uuid();
                INSERT INTO rentprog_employees (id, rentprog_id, name, data)
                VALUES (
                  employee_uuid,
                  new_id,
                  COALESCE(new_name, 'Employee ' || new_id),
                  jsonb_build_object('id', new_id, 'name', new_name, 'source_field', field_key)
                );
                INSERT INTO external_refs (entity_type, entity_id, system, external_id)
                VALUES ('rentprog_employee', employee_uuid, 'rentprog', new_id);
                RAISE NOTICE '✅ Created new employee: %', employee_uuid;
              END IF;

              -- Устанавливаем responsible_id на НОВОГО сотрудника
              IF field_key = 'responsible_id' THEN
                NEW.responsible_id := employee_uuid;
                RAISE NOTICE '✅ Set NEW.responsible_id to: %', employee_uuid;
              END IF;
            END IF;

          ELSE
            -- Одиночное значение
            RAISE NOTICE '🔍 Field % is SINGLE VALUE', field_key;
            
            IF id_value IS NOT NULL AND id_value != 'null' AND id_value != '' THEN
              RAISE NOTICE '🔄 Processing single employee: %', id_value;
              
              SELECT entity_id INTO employee_uuid
              FROM external_refs
              WHERE system = 'rentprog'
                AND external_id = id_value
                AND entity_type = 'rentprog_employee';

              IF employee_uuid IS NOT NULL THEN
                RAISE NOTICE '✅ Single employee found: %', employee_uuid;
                IF name_value IS NOT NULL AND name_value != 'null' AND name_value != '' THEN
                  UPDATE rentprog_employees
                  SET
                    name = name_value,
                    updated_at = NOW()
                  WHERE id = employee_uuid
                    AND (name IS NULL OR name != name_value);
                  RAISE NOTICE '✅ Updated single employee name to: %', name_value;
                END IF;
              ELSE
                RAISE NOTICE '🆕 Creating single employee: %', id_value;
                employee_uuid := gen_random_uuid();
                INSERT INTO rentprog_employees (id, rentprog_id, name, data)
                VALUES (
                  employee_uuid,
                  id_value,
                  COALESCE(name_value, 'Employee ' || id_value),
                  jsonb_build_object('id', id_value, 'name', name_value, 'source_field', field_key)
                );
                INSERT INTO external_refs (entity_type, entity_id, system, external_id)
                VALUES ('rentprog_employee', employee_uuid, 'rentprog', id_value);
                RAISE NOTICE '✅ Created single employee: %', employee_uuid;
              END IF;

              IF field_key = 'responsible_id' THEN
                NEW.responsible_id := employee_uuid;
                RAISE NOTICE '✅ Set NEW.responsible_id to: %', employee_uuid;
              END IF;
            END IF;
          END IF;
        END LOOP;

        -- ========== ОЧИСТКА DATA ПОСЛЕ ОБРАБОТКИ ==========
        NEW.data := '{}'::JSONB;
        RAISE NOTICE '🔍 TRIGGER END: cleaned data, responsible_id = %', NEW.responsible_id;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('✅ DEBUG добавлен в триггер!\n');
    console.log('Теперь запустите final_complete_test.mjs и смотрите NOTICE сообщения\n');
    
  } finally {
    await sql.end();
  }
}

addDebug();

