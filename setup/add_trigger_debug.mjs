#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function addTriggerDebug() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n🔧 Добавление отладки в триггер...\n');

  try {
    await sql`DROP TRIGGER IF EXISTS process_booking_nested_entities_trigger ON bookings;`;
    await sql`DROP FUNCTION IF EXISTS process_booking_nested_entities();`;

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
      BEGIN
        RAISE NOTICE 'Trigger fired! NEW.data IS NULL: %', (NEW.data IS NULL);
        
        IF NEW.data IS NULL THEN
          RAISE NOTICE 'Skipping - data is NULL';
          RETURN NEW;
        END IF;

        RAISE NOTICE 'NEW.data type: %', jsonb_typeof(NEW.data);
        RAISE NOTICE 'NEW.data sample: %', left(NEW.data::TEXT, 200);

        car_data := NEW.data->'car';
        client_data := NEW.data->'client';

        RAISE NOTICE 'car_data IS NULL: %, client_data IS NULL: %', (car_data IS NULL), (client_data IS NULL);

        -- ========== РАСКЛАДКА ПОЛЕЙ БРОНИ ==========
        IF NEW.data->'start_date_formatted' IS NOT NULL THEN
          NEW.start_date := (NEW.data->>'start_date_formatted')::TIMESTAMPTZ;
          RAISE NOTICE 'Set start_date from start_date_formatted: %', NEW.start_date;
        ELSIF NEW.data->'start_date' IS NOT NULL THEN
          BEGIN
            NEW.start_date := to_timestamp(NEW.data->>'start_date', 'DD-MM-YYYY HH24:MI')::TIMESTAMPTZ;
            RAISE NOTICE 'Set start_date from start_date: %', NEW.start_date;
          EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Failed to parse start_date: %', SQLERRM;
          END;
        END IF;

        IF NEW.data->'state' IS NOT NULL THEN
          NEW.state := NEW.data->>'state';
          RAISE NOTICE 'Set state: %', NEW.state;
        END IF;

        -- ========== ОБРАБОТКА CAR ==========
        IF car_data IS NOT NULL AND car_data->>'id' IS NOT NULL THEN
          RAISE NOTICE 'Processing car: %', car_data->>'id';
          car_rentprog_id := car_data->>'id';
          
          SELECT entity_id INTO car_uuid
          FROM external_refs
          WHERE system = 'rentprog' AND external_id = car_rentprog_id AND entity_type = 'car';
          
          IF car_uuid IS NULL THEN
            car_uuid := gen_random_uuid();
            
            INSERT INTO cars (id, data, rentprog_id, plate, vin, model)
            VALUES (car_uuid, car_data, car_rentprog_id, car_data->>'number', car_data->>'vin', car_data->>'car_name');
            
            INSERT INTO external_refs (entity_type, entity_id, system, external_id)
            VALUES ('car', car_uuid, 'rentprog', car_rentprog_id);
            
            RAISE NOTICE 'Created car: %', car_uuid;
          ELSE
            UPDATE cars SET data = car_data, updated_at = NOW() WHERE id = car_uuid;
            RAISE NOTICE 'Updated car: %', car_uuid;
          END IF;
          
          NEW.car_id := car_uuid;
          RAISE NOTICE 'Set NEW.car_id: %', NEW.car_id;
        ELSE
          RAISE NOTICE 'Skipping car - no data or no id';
        END IF;

        -- ========== ОБРАБОТКА CLIENT ==========
        IF client_data IS NOT NULL AND client_data->>'id' IS NOT NULL THEN
          RAISE NOTICE 'Processing client: %', client_data->>'id';
          client_rentprog_id := client_data->>'id';
          
          SELECT entity_id INTO client_uuid
          FROM external_refs
          WHERE system = 'rentprog' AND external_id = client_rentprog_id AND entity_type = 'client';
          
          IF client_uuid IS NULL THEN
            client_uuid := gen_random_uuid();
            
            INSERT INTO clients (id, data, name, lastname, phone)
            VALUES (client_uuid, client_data, client_data->>'name', client_data->>'lastname', client_data->>'phone');
            
            INSERT INTO external_refs (entity_type, entity_id, system, external_id)
            VALUES ('client', client_uuid, 'rentprog', client_rentprog_id);
            
            RAISE NOTICE 'Created client: %', client_uuid;
          ELSE
            UPDATE clients SET data = client_data, updated_at = NOW() WHERE id = client_uuid;
            RAISE NOTICE 'Updated client: %', client_uuid;
          END IF;
          
          NEW.client_id := client_uuid;
          RAISE NOTICE 'Set NEW.client_id: %', NEW.client_id;
        ELSE
          RAISE NOTICE 'Skipping client - no data or no id';
        END IF;

        RAISE NOTICE 'Trigger complete - returning NEW';
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await sql`
      CREATE TRIGGER process_booking_nested_entities_trigger
      BEFORE INSERT OR UPDATE ON bookings
      FOR EACH ROW
      EXECUTE FUNCTION process_booking_nested_entities();
    `;

    console.log('✅ Триггер с отладкой создан!');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

addTriggerDebug();

