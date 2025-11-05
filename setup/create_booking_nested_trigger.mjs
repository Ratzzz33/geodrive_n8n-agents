#!/usr/bin/env node
/**
 * Создание PostgreSQL триггера для автоматической обработки
 * вложенных car и client объектов при сохранении booking
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function createTrigger() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n🔧 Создание триггера для обработки вложенных car/client...\n');

  try {
    // 1. Удаляем старый триггер если есть
    console.log('1️⃣ Удаление старого триггера...');
    await sql.unsafe(`
      DROP TRIGGER IF EXISTS process_booking_nested_entities_trigger ON bookings CASCADE;
    `);
    await sql.unsafe(`
      DROP FUNCTION IF EXISTS process_booking_nested_entities() CASCADE;
    `);
    console.log('   ✓ Старый триггер удалён');

    // 2. Создаём функцию триггера
    console.log('\n2️⃣ Создание функции триггера...');
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
        car_ref_exists BOOLEAN;
        client_ref_exists BOOLEAN;
      BEGIN
        -- Проверяем, есть ли data (только для bookings)
        IF NEW.data IS NULL THEN
          RETURN NEW;
        END IF;

        -- Извлекаем car и client из data
        car_data := NEW.data->'car';
        client_data := NEW.data->'client';

        -- ========== ОБРАБОТКА CAR ==========
        IF car_data IS NOT NULL AND car_data->>'id' IS NOT NULL THEN
          car_rentprog_id := car_data->>'id';
          
          RAISE NOTICE 'Processing car: %', car_rentprog_id;
          
          -- Проверяем, есть ли уже car в external_refs
          SELECT entity_id INTO car_uuid
          FROM external_refs
          WHERE system = 'rentprog' 
            AND external_id = car_rentprog_id 
            AND entity_type = 'car';
          
          IF car_uuid IS NULL THEN
            -- Создаём новую машину
            car_uuid := gen_random_uuid();
            
            RAISE NOTICE 'Creating new car: %', car_uuid;
            
            -- Вставляем в cars
            INSERT INTO cars (id, data)
            VALUES (car_uuid, car_data);
            
            -- Создаём external_ref
            INSERT INTO external_refs (entity_type, entity_id, system, external_id)
            VALUES ('car', car_uuid, 'rentprog', car_rentprog_id);
            
            RAISE NOTICE 'Car created successfully';
          ELSE
            -- Обновляем существующую машину
            RAISE NOTICE 'Updating existing car: %', car_uuid;
            
            UPDATE cars 
            SET data = car_data, 
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = car_uuid;
            
            RAISE NOTICE 'Car updated successfully';
          END IF;
          
          -- Устанавливаем car_id в booking
          NEW.car_id := car_uuid;
          
          RAISE NOTICE 'Set booking.car_id = %', car_uuid;
        END IF;

        -- ========== ОБРАБОТКА CLIENT ==========
        IF client_data IS NOT NULL AND client_data->>'id' IS NOT NULL THEN
          client_rentprog_id := client_data->>'id';
          
          RAISE NOTICE 'Processing client: %', client_rentprog_id;
          
          -- Проверяем, есть ли уже client в external_refs
          SELECT entity_id INTO client_uuid
          FROM external_refs
          WHERE system = 'rentprog' 
            AND external_id = client_rentprog_id 
            AND entity_type = 'client';
          
          IF client_uuid IS NULL THEN
            -- Создаём нового клиента
            client_uuid := gen_random_uuid();
            
            RAISE NOTICE 'Creating new client: %', client_uuid;
            
            -- Вставляем в clients
            INSERT INTO clients (id, data)
            VALUES (client_uuid, client_data);
            
            -- Создаём external_ref
            INSERT INTO external_refs (entity_type, entity_id, system, external_id)
            VALUES ('client', client_uuid, 'rentprog', client_rentprog_id);
            
            RAISE NOTICE 'Client created successfully';
          ELSE
            -- Обновляем существующего клиента
            RAISE NOTICE 'Updating existing client: %', client_uuid;
            
            UPDATE clients 
            SET data = client_data, 
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = client_uuid;
            
            RAISE NOTICE 'Client updated successfully';
          END IF;
          
          -- Устанавливаем client_id в booking
          NEW.client_id := client_uuid;
          
          RAISE NOTICE 'Set booking.client_id = %', client_uuid;
        END IF;

        RETURN NEW;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Error in process_booking_nested_entities: % %', SQLERRM, SQLSTATE;
          -- Возвращаем NEW даже при ошибке, чтобы booking всё равно сохранился
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('   ✓ Функция создана');

    // 3. Создаём триггер
    console.log('\n3️⃣ Создание триггера...');
    await sql.unsafe(`
      CREATE TRIGGER process_booking_nested_entities_trigger
      BEFORE INSERT OR UPDATE ON bookings
      FOR EACH ROW
      EXECUTE FUNCTION process_booking_nested_entities();
    `);
    console.log('   ✓ Триггер создан');

    console.log('\n✅ Триггер успешно установлен!\n');
    console.log('📝 Триггер будет автоматически:');
    console.log('   1. Извлекать car и client из booking.data');
    console.log('   2. Создавать/обновлять записи в cars и clients');
    console.log('   3. Устанавливать car_id и client_id в booking');
    console.log('   4. Всё это происходит АВТОМАТИЧЕСКИ при каждом INSERT/UPDATE booking\n');

  } catch (error) {
    console.error('\n❌ Ошибка при создании триггера:', error.message);
    if (error.position) {
      console.error(`   Position: ${error.position}`);
    }
    process.exit(1);
  } finally {
    await sql.end();
  }
}

createTrigger();

