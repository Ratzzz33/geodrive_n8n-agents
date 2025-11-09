#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function fixBookingsResponsibleFK() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n🔧 Исправление bookings.responsible_id → rentprog_employees\n');

  try {
    // 1. Удалить старую колонку если есть (с FK на employees)
    console.log('1️⃣ Проверка и удаление старой колонки...');
    await sql`
      ALTER TABLE bookings 
      DROP COLUMN IF EXISTS responsible_id CASCADE;
    `;
    console.log('   ✅ Старая колонка удалена');

    // 2. Создать правильную колонку с FK на rentprog_employees
    console.log('\n2️⃣ Создание колонки responsible_id → rentprog_employees...');
    await sql`
      ALTER TABLE bookings 
      ADD COLUMN responsible_id UUID REFERENCES rentprog_employees(id);
    `;
    console.log('   ✅ Колонка создана с правильным FK');

    // 3. Создать индекс
    console.log('\n3️⃣ Создание индекса...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_bookings_responsible 
      ON bookings(responsible_id);
    `;
    console.log('   ✅ Индекс создан');

    // 4. Обновить триггер extract_rentprog_employees_from_data
    console.log('\n4️⃣ Обновление триггера для заполнения responsible_id...');
    await sql.unsafe(`
      CREATE OR REPLACE FUNCTION extract_rentprog_employees_from_data()
      RETURNS TRIGGER AS $$
      DECLARE
        employee_fields JSONB := '{
          "responsible_id": "responsible",
          "start_worker_id": "start_worker_name",
          "end_worker_id": "end_worker_name",
          "updater": null,
          "state_updater": null,
          "user_id": null
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
        -- Если NEW.data пустой или NULL, пропускаем
        IF NEW.data IS NULL OR NEW.data = '{}'::jsonb THEN
          RETURN NEW;
        END IF;
        
        -- Проходим по всем полям с ID сотрудников
        FOR field_key IN SELECT jsonb_object_keys(employee_fields) LOOP
          name_field := employee_fields->>field_key;
          id_value := NEW.data->>field_key;
          
          IF id_value IS NULL OR id_value = 'null' THEN
            CONTINUE;
          END IF;
          
          BEGIN
            id_array := (NEW.data->field_key);
            
            -- Если это массив с 2 элементами [old, new]
            IF jsonb_typeof(id_array) = 'array' AND jsonb_array_length(id_array) = 2 THEN
              old_id := id_array->>0;
              new_id := id_array->>1;
              
              -- Извлекаем имена
              IF name_field IS NOT NULL THEN
                name_array := (NEW.data->name_field);
                IF jsonb_typeof(name_array) = 'array' AND jsonb_array_length(name_array) = 2 THEN
                  old_name := name_array->>0;
                  new_name := name_array->>1;
                END IF;
              END IF;
              
              -- Обрабатываем OLD значение
              IF old_id IS NOT NULL AND old_id != 'null' AND old_id != '' THEN
                SELECT entity_id INTO employee_uuid
                FROM external_refs
                WHERE system = 'rentprog' 
                  AND external_id = old_id 
                  AND entity_type = 'rentprog_employee';
                
                IF employee_uuid IS NULL THEN
                  employee_uuid := gen_random_uuid();
                  
                  INSERT INTO rentprog_employees (id, rentprog_id, name, data)
                  VALUES (
                    employee_uuid,
                    old_id,
                    COALESCE(old_name, 'Employee ' || old_id),
                    jsonb_build_object('id', old_id, 'name', old_name, 'source_field', field_key)
                  )
                  ON CONFLICT (rentprog_id) DO UPDATE
                  SET 
                    name = COALESCE(EXCLUDED.name, rentprog_employees.name),
                    updated_at = NOW();
                  
                  INSERT INTO external_refs (entity_type, entity_id, system, external_id)
                  VALUES ('rentprog_employee', employee_uuid, 'rentprog', old_id)
                  ON CONFLICT (system, external_id) DO NOTHING;
                  
                  RAISE NOTICE 'Created rentprog_employee (old): % - %', old_id, COALESCE(old_name, 'Unknown');
                END IF;
              END IF;
              
              -- Обрабатываем NEW значение
              IF new_id IS NOT NULL AND new_id != 'null' AND new_id != '' THEN
                SELECT entity_id INTO employee_uuid
                FROM external_refs
                WHERE system = 'rentprog' 
                  AND external_id = new_id 
                  AND entity_type = 'rentprog_employee';
                
                IF employee_uuid IS NULL THEN
                  employee_uuid := gen_random_uuid();
                  
                  INSERT INTO rentprog_employees (id, rentprog_id, name, data)
                  VALUES (
                    employee_uuid,
                    new_id,
                    COALESCE(new_name, 'Employee ' || new_id),
                    jsonb_build_object('id', new_id, 'name', new_name, 'source_field', field_key)
                  )
                  ON CONFLICT (rentprog_id) DO UPDATE
                  SET 
                    name = COALESCE(EXCLUDED.name, rentprog_employees.name),
                    updated_at = NOW();
                  
                  INSERT INTO external_refs (entity_type, entity_id, system, external_id)
                  VALUES ('rentprog_employee', employee_uuid, 'rentprog', new_id)
                  ON CONFLICT (system, external_id) DO NOTHING;
                  
                  RAISE NOTICE 'Created rentprog_employee (new): % - %', new_id, COALESCE(new_name, 'Unknown');
                END IF;
                
                -- ========== ЗАПОЛНЯЕМ responsible_id В bookings ==========
                IF field_key = 'responsible_id' AND TG_TABLE_NAME = 'bookings' THEN
                  NEW.responsible_id := employee_uuid;
                  RAISE NOTICE 'Set booking.responsible_id to % (%)', employee_uuid, COALESCE(new_name, new_id);
                END IF;
              END IF;
              
            ELSE
              -- Это не массив (CREATE событие)
              id_value := id_array#>>'{}'::text[];
              
              IF name_field IS NOT NULL THEN
                name_value := NEW.data->>name_field;
              END IF;
              
              IF id_value IS NOT NULL AND id_value != 'null' AND id_value != '' THEN
                SELECT entity_id INTO employee_uuid
                FROM external_refs
                WHERE system = 'rentprog' 
                  AND external_id = id_value 
                  AND entity_type = 'rentprog_employee';
                
                IF employee_uuid IS NULL THEN
                  employee_uuid := gen_random_uuid();
                  
                  INSERT INTO rentprog_employees (id, rentprog_id, name, data)
                  VALUES (
                    employee_uuid,
                    id_value,
                    COALESCE(name_value, 'Employee ' || id_value),
                    jsonb_build_object('id', id_value, 'name', name_value, 'source_field', field_key)
                  )
                  ON CONFLICT (rentprog_id) DO UPDATE
                  SET 
                    name = COALESCE(EXCLUDED.name, rentprog_employees.name),
                    updated_at = NOW();
                  
                  INSERT INTO external_refs (entity_type, entity_id, system, external_id)
                  VALUES ('rentprog_employee', employee_uuid, 'rentprog', id_value)
                  ON CONFLICT (system, external_id) DO NOTHING;
                  
                  RAISE NOTICE 'Created rentprog_employee: % - %', id_value, COALESCE(name_value, 'Unknown');
                END IF;
                
                -- ========== ЗАПОЛНЯЕМ responsible_id В bookings ==========
                IF field_key = 'responsible_id' AND TG_TABLE_NAME = 'bookings' THEN
                  NEW.responsible_id := employee_uuid;
                  RAISE NOTICE 'Set booking.responsible_id to % (%)', employee_uuid, COALESCE(name_value, id_value);
                END IF;
              END IF;
            END IF;
            
          EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error processing field %: %', field_key, SQLERRM;
            CONTINUE;
          END;
        END LOOP;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('   ✅ Триггер обновлен');

    console.log('\n✅ Миграция завершена успешно!');
    console.log('\n📋 Итог:');
    console.log('   • bookings.responsible_id → rentprog_employees.id ✅');
    console.log('   • Индекс idx_bookings_responsible создан ✅');
    console.log('   • Триггер extract_rentprog_employees_from_data обновлен ✅');
    console.log('\n🔄 При следующем вебхуке с responsible_id:');
    console.log('   1. Создастся запись в rentprog_employees');
    console.log('   2. Создастся external_refs (rentprog → rentprog_employee)');
    console.log('   3. В bookings.responsible_id запишется UUID из rentprog_employees');

  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    if (error.detail) {
      console.error('   Детали:', error.detail);
    }
    process.exit(1);
  } finally {
    await sql.end();
  }
}

fixBookingsResponsibleFK();

