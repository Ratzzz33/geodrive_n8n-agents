#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function mergeTriggers() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n🔧 Объединение триггеров: process_booking_nested_entities + extract employees\n');

  try {
    // 1. Удалить старый триггер extract_rentprog_employees
    console.log('1️⃣ Удаление дублирующего триггера...');
    await sql`DROP TRIGGER IF EXISTS extract_rentprog_employees_from_bookings_trigger ON bookings`;
    await sql`DROP TRIGGER IF EXISTS extract_rentprog_employees_from_cars_trigger ON cars`;
    console.log('   ✅ Старые триггеры удалены');

    // 2. Создать объединенную функцию
    console.log('\n2️⃣ Создание объединенной функции process_booking_nested_entities...');
    
    await sql.unsafe(`
      CREATE OR REPLACE FUNCTION process_booking_nested_entities()
      RETURNS TRIGGER AS $$
      DECLARE
        car_data JSONB;
        client_data JSONB;
        car_uuid UUID;
        client_uuid UUID;
        car_rentprog_id TEXT;
        client_rentprog_id TEXT;
        
        -- Для извлечения сотрудников
        employee_fields JSONB := '{
          "responsible_id": "responsible",
          "start_worker_id": "start_worker_name",
          "end_worker_id": "end_worker_name"
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
        current_name TEXT;
      BEGIN
        -- Если data пустой - пропускаем
        IF NEW.data IS NULL OR NEW.data = '{}'::jsonb THEN
          RETURN NEW;
        END IF;

        car_data := NEW.data->'car';
        client_data := NEW.data->'client';

        -- ========== РАСКЛАДКА ПОЛЕЙ БРОНИ ==========
        IF NEW.data->'start_date_formatted' IS NOT NULL THEN
          NEW.start_date := (NEW.data->>'start_date_formatted')::TIMESTAMPTZ;
        ELSIF NEW.data->'start_date' IS NOT NULL THEN
          BEGIN
            NEW.start_date := to_timestamp(NEW.data->>'start_date', 'DD-MM-YYYY HH24:MI')::TIMESTAMPTZ;
          EXCEPTION WHEN OTHERS THEN
            NULL;
          END;
        END IF;

        IF NEW.data->'end_date_formatted' IS NOT NULL THEN
          NEW.end_date := (NEW.data->>'end_date_formatted')::TIMESTAMPTZ;
        ELSIF NEW.data->'end_date' IS NOT NULL THEN
          BEGIN
            NEW.end_date := to_timestamp(NEW.data->>'end_date', 'DD-MM-YYYY HH24:MI')::TIMESTAMPTZ;
          EXCEPTION WHEN OTHERS THEN
            NULL;
          END;
        END IF;

        IF NEW.data->'state' IS NOT NULL THEN
          NEW.state := NEW.data->>'state';
        END IF;

        IF NEW.data->'price' IS NOT NULL THEN
          NEW.price := (NEW.data->>'price')::NUMERIC;
        END IF;

        IF NEW.data->'days' IS NOT NULL THEN
          NEW.days := (NEW.data->>'days')::NUMERIC;
        END IF;

        IF NEW.data->'total' IS NOT NULL THEN
          NEW.total := (NEW.data->>'total')::NUMERIC;
        END IF;

        IF NEW.data->'deposit' IS NOT NULL THEN
          NEW.deposit := (NEW.data->>'deposit')::NUMERIC;
        END IF;

        -- ========== ОБРАБОТКА CAR ==========
        IF car_data IS NOT NULL AND car_data->>'id' IS NOT NULL THEN
          car_rentprog_id := car_data->>'id';
          
          SELECT entity_id INTO car_uuid
          FROM external_refs
          WHERE system = 'rentprog' AND external_id = car_rentprog_id AND entity_type = 'car';
          
          IF car_uuid IS NULL THEN
            car_uuid := gen_random_uuid();
            
            INSERT INTO cars (id, data, rentprog_id, plate, vin, model, transmission, fuel, year, color, mileage)
            VALUES (
              car_uuid, car_data, car_rentprog_id, car_data->>'number', car_data->>'vin', 
              car_data->>'car_name', car_data->>'transmission', car_data->>'fuel', 
              (car_data->>'year')::INTEGER, car_data->>'color', (car_data->>'mileage')::INTEGER
            );
            
            INSERT INTO external_refs (entity_type, entity_id, system, external_id)
            VALUES ('car', car_uuid, 'rentprog', car_rentprog_id);
          ELSE
            UPDATE cars SET 
              data = car_data,
              plate = car_data->>'number',
              vin = car_data->>'vin',
              model = car_data->>'car_name',
              transmission = car_data->>'transmission',
              fuel = car_data->>'fuel',
              year = (car_data->>'year')::INTEGER,
              color = car_data->>'color',
              mileage = (car_data->>'mileage')::INTEGER,
              updated_at = NOW()
            WHERE id = car_uuid;
          END IF;
          
          NEW.car_id := car_uuid;
        END IF;

        -- ========== ОБРАБОТКА CLIENT ==========
        IF client_data IS NOT NULL AND client_data->>'id' IS NOT NULL THEN
          client_rentprog_id := client_data->>'id';
          
          SELECT entity_id INTO client_uuid
          FROM external_refs
          WHERE system = 'rentprog' AND external_id = client_rentprog_id AND entity_type = 'client';
          
          IF client_uuid IS NULL THEN
            client_uuid := gen_random_uuid();
            
            INSERT INTO clients (id, data, name, lastname, phone, email, fio, lang, category)
            VALUES (
              client_uuid, client_data,
              client_data->>'name', client_data->>'lastname', client_data->>'phone',
              client_data->>'email', client_data->>'fio', client_data->>'lang',
              client_data->>'category'
            );
            
            INSERT INTO external_refs (entity_type, entity_id, system, external_id)
            VALUES ('client', client_uuid, 'rentprog', client_rentprog_id);
          ELSE
            UPDATE clients SET
              data = client_data,
              name = client_data->>'name',
              lastname = client_data->>'lastname',
              phone = client_data->>'phone',
              email = client_data->>'email',
              fio = client_data->>'fio',
              lang = client_data->>'lang',
              category = client_data->>'category',
              updated_at = NOW()
            WHERE id = client_uuid;
          END IF;
          
          NEW.client_id := client_uuid;
        END IF;

        -- ========== ИЗВЛЕЧЕНИЕ СОТРУДНИКОВ (ПЕРЕД ОЧИСТКОЙ DATA!) ==========
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
              
              IF name_field IS NOT NULL THEN
                name_array := (NEW.data->name_field);
                IF jsonb_typeof(name_array) = 'array' AND jsonb_array_length(name_array) = 2 THEN
                  old_name := name_array->>0;
                  new_name := name_array->>1;
                END IF;
              END IF;
              
              -- Обработка OLD сотрудника
              IF old_id IS NOT NULL AND old_id != 'null' AND old_id != '' THEN
                SELECT entity_id INTO employee_uuid
                FROM external_refs
                WHERE system = 'rentprog' AND external_id = old_id AND entity_type = 'rentprog_employee';
                
                IF employee_uuid IS NOT NULL THEN
                  IF old_name IS NOT NULL AND old_name != 'null' AND old_name != '' THEN
                    SELECT name INTO current_name FROM rentprog_employees WHERE id = employee_uuid;
                    IF current_name IS NULL OR current_name != old_name THEN
                      UPDATE rentprog_employees SET name = old_name, updated_at = NOW() WHERE id = employee_uuid;
                    END IF;
                  END IF;
                ELSE
                  employee_uuid := gen_random_uuid();
                  INSERT INTO rentprog_employees (id, rentprog_id, name, data)
                  VALUES (employee_uuid, old_id, COALESCE(old_name, 'Employee ' || old_id), jsonb_build_object('id', old_id, 'name', old_name));
                  INSERT INTO external_refs (entity_type, entity_id, system, external_id)
                  VALUES ('rentprog_employee', employee_uuid, 'rentprog', old_id);
                END IF;
              END IF;
              
              -- Обработка NEW сотрудника
              IF new_id IS NOT NULL AND new_id != 'null' AND new_id != '' THEN
                SELECT entity_id INTO employee_uuid
                FROM external_refs
                WHERE system = 'rentprog' AND external_id = new_id AND entity_type = 'rentprog_employee';
                
                IF employee_uuid IS NOT NULL THEN
                  IF new_name IS NOT NULL AND new_name != 'null' AND new_name != '' THEN
                    SELECT name INTO current_name FROM rentprog_employees WHERE id = employee_uuid;
                    IF current_name IS NULL OR current_name != new_name THEN
                      UPDATE rentprog_employees SET name = new_name, updated_at = NOW() WHERE id = employee_uuid;
                    END IF;
                  END IF;
                ELSE
                  employee_uuid := gen_random_uuid();
                  INSERT INTO rentprog_employees (id, rentprog_id, name, data)
                  VALUES (employee_uuid, new_id, COALESCE(new_name, 'Employee ' || new_id), jsonb_build_object('id', new_id, 'name', new_name));
                  INSERT INTO external_refs (entity_type, entity_id, system, external_id)
                  VALUES ('rentprog_employee', employee_uuid, 'rentprog', new_id);
                END IF;
                
                -- ЗАПОЛНЯЕМ responsible_id
                IF field_key = 'responsible_id' THEN
                  NEW.responsible_id := employee_uuid;
                END IF;
              END IF;
              
            ELSE
              -- Не массив (CREATE событие)
              id_value := id_array#>>'{}'::text[];
              IF name_field IS NOT NULL THEN
                name_value := NEW.data->>name_field;
              END IF;
              
              IF id_value IS NOT NULL AND id_value != 'null' AND id_value != '' THEN
                SELECT entity_id INTO employee_uuid
                FROM external_refs
                WHERE system = 'rentprog' AND external_id = id_value AND entity_type = 'rentprog_employee';
                
                IF employee_uuid IS NOT NULL THEN
                  IF name_value IS NOT NULL AND name_value != 'null' AND name_value != '' THEN
                    SELECT name INTO current_name FROM rentprog_employees WHERE id = employee_uuid;
                    IF current_name IS NULL OR current_name != name_value THEN
                      UPDATE rentprog_employees SET name = name_value, updated_at = NOW() WHERE id = employee_uuid;
                    END IF;
                  END IF;
                ELSE
                  employee_uuid := gen_random_uuid();
                  INSERT INTO rentprog_employees (id, rentprog_id, name, data)
                  VALUES (employee_uuid, id_value, COALESCE(name_value, 'Employee ' || id_value), jsonb_build_object('id', id_value, 'name', name_value));
                  INSERT INTO external_refs (entity_type, entity_id, system, external_id)
                  VALUES ('rentprog_employee', employee_uuid, 'rentprog', id_value);
                END IF;
                
                IF field_key = 'responsible_id' THEN
                  NEW.responsible_id := employee_uuid;
                END IF;
              END IF;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            CONTINUE;
          END;
        END LOOP;

        -- ========== ОЧИСТКА DATA ==========
        NEW.data := '{}'::JSONB;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('   ✅ Объединенная функция создана');

    console.log('\n✅ Объединение завершено!');
    console.log('\n📋 Итог:');
    console.log('   • Один триггер вместо двух ✅');
    console.log('   • Извлечение сотрудников ПЕРЕД очисткой data ✅');
    console.log('   • Правильная логика upsert (проверка → update/insert) ✅');
    console.log('   • Заполнение bookings.responsible_id ✅');

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

mergeTriggers();

