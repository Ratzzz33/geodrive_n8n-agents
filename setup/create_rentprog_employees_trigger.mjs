#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 10,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('🔧 Создание системы автоматического сбора сотрудников RentProg\n');
  console.log('='.repeat(60));

  try {
    // 1. Создать таблицу rentprog_employees
    console.log('\n1️⃣ Создание таблицы rentprog_employees...');
    await sql`
      CREATE TABLE IF NOT EXISTS rentprog_employees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rentprog_id TEXT UNIQUE NOT NULL,
        name TEXT,
        first_name TEXT,
        last_name TEXT,
        company_id INTEGER,
        data JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('   ✅ Таблица rentprog_employees создана');

    // 2. Индексы
    console.log('\n2️⃣ Создание индексов...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_rentprog_employees_rentprog_id 
      ON rentprog_employees(rentprog_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_rentprog_employees_company_id 
      ON rentprog_employees(company_id)
    `;
    console.log('   ✅ Индексы созданы');

    // 3. Функция триггера
    console.log('\n3️⃣ Создание функции триггера...');
    await sql`
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
        IF NEW.data IS NULL OR NEW.data = '{}'::jsonb THEN
          RETURN NEW;
        END IF;
        
        FOR field_key IN SELECT jsonb_object_keys(employee_fields) LOOP
          name_field := employee_fields->>field_key;
          id_value := NEW.data->>field_key;
          
          IF id_value IS NULL OR id_value = 'null' THEN
            CONTINUE;
          END IF;
          
          BEGIN
            id_array := (NEW.data->field_key);
            
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
                    jsonb_build_object(
                      'id', old_id,
                      'name', old_name,
                      'source_field', field_key
                    )
                  )
                  ON CONFLICT (rentprog_id) DO UPDATE
                  SET 
                    name = COALESCE(EXCLUDED.name, rentprog_employees.name),
                    updated_at = NOW();
                  
                  INSERT INTO external_refs (entity_type, entity_id, system, external_id)
                  VALUES ('rentprog_employee', employee_uuid, 'rentprog', old_id)
                  ON CONFLICT (system, external_id) DO NOTHING;
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
                    jsonb_build_object(
                      'id', new_id,
                      'name', new_name,
                      'source_field', field_key
                    )
                  )
                  ON CONFLICT (rentprog_id) DO UPDATE
                  SET 
                    name = COALESCE(EXCLUDED.name, rentprog_employees.name),
                    updated_at = NOW();
                  
                  INSERT INTO external_refs (entity_type, entity_id, system, external_id)
                  VALUES ('rentprog_employee', employee_uuid, 'rentprog', new_id)
                  ON CONFLICT (system, external_id) DO NOTHING;
                END IF;
              END IF;
              
            ELSE
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
                    jsonb_build_object(
                      'id', id_value,
                      'name', name_value,
                      'source_field', field_key
                    )
                  )
                  ON CONFLICT (rentprog_id) DO UPDATE
                  SET 
                    name = COALESCE(EXCLUDED.name, rentprog_employees.name),
                    updated_at = NOW();
                  
                  INSERT INTO external_refs (entity_type, entity_id, system, external_id)
                  VALUES ('rentprog_employee', employee_uuid, 'rentprog', id_value)
                  ON CONFLICT (system, external_id) DO NOTHING;
                END IF;
              END IF;
            END IF;
            
          EXCEPTION WHEN OTHERS THEN
            CONTINUE;
          END;
        END LOOP;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;
    console.log('   ✅ Функция триггера создана');

    // 4. Триггер на bookings
    console.log('\n4️⃣ Создание триггера на bookings...');
    
    await sql`
      DROP TRIGGER IF EXISTS extract_rentprog_employees_from_bookings_trigger ON bookings
    `;
    
    await sql`
      CREATE TRIGGER extract_rentprog_employees_from_bookings_trigger
      AFTER INSERT OR UPDATE ON bookings
      FOR EACH ROW
      EXECUTE FUNCTION extract_rentprog_employees_from_data()
    `;
    console.log('   ✅ Триггер на bookings создан');

    // 5. Триггер на cars
    console.log('\n5️⃣ Создание триггера на cars...');
    
    await sql`
      DROP TRIGGER IF EXISTS extract_rentprog_employees_from_cars_trigger ON cars
    `;
    
    await sql`
      CREATE TRIGGER extract_rentprog_employees_from_cars_trigger
      AFTER INSERT OR UPDATE ON cars
      FOR EACH ROW
      EXECUTE FUNCTION extract_rentprog_employees_from_data()
    `;
    console.log('   ✅ Триггер на cars создан');

    console.log('\n✅ Все компоненты созданы!');
    console.log('\n📋 Что создано:');
    console.log('   - Таблица: rentprog_employees (отдельная от employees!)');
    console.log('   - Индексы: rentprog_id, company_id');
    console.log('   - Функция: extract_rentprog_employees_from_data()');
    console.log('   - Триггер: bookings → extract_rentprog_employees_from_bookings_trigger');
    console.log('   - Триггер: cars → extract_rentprog_employees_from_cars_trigger');
    console.log('   - Entity type: rentprog_employee (в external_refs)');
    
    console.log('\n🎯 Следующий шаг:');
    console.log('   node setup/collect_historical_rentprog_employees.mjs');

  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

main().catch(console.error);

