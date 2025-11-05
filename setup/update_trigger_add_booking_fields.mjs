#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function updateTrigger() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n🔧 Обновление триггера: добавляем раскладку полей брони...\n');

  try {
    // 1. Удалить старый триггер и функцию
    console.log('1️⃣ Удаление старого триггера...');
    await sql`DROP TRIGGER IF EXISTS process_booking_nested_entities_trigger ON bookings;`;
    await sql`DROP FUNCTION IF EXISTS process_booking_nested_entities();`;
    console.log('   ✓ Старый триггер удалён');

    // 2. Создать новую функцию триггера с раскладкой полей БРОНИ
    console.log('\n2️⃣ Создание новой функции триггера...');
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
        IF NEW.data IS NULL THEN
          RETURN NEW;
        END IF;

        car_data := NEW.data->'car';
        client_data := NEW.data->'client';

        -- ========== РАСКЛАДКА ПОЛЕЙ БРОНИ ==========
        -- Извлекаем поля из NEW.data и устанавливаем в NEW
        IF NEW.data->'start_date_formatted' IS NOT NULL THEN
          NEW.start_date := (NEW.data->>'start_date_formatted')::TIMESTAMPTZ;
        ELSIF NEW.data->'start_date' IS NOT NULL THEN
          -- Парсим формат "10-11-2025 1:30"
          BEGIN
            NEW.start_date := to_timestamp(NEW.data->>'start_date', 'DD-MM-YYYY HH24:MI')::TIMESTAMPTZ;
          EXCEPTION WHEN OTHERS THEN
            -- Если парсинг не удался, пропускаем
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
            
            INSERT INTO cars (
              id, data, rentprog_id, plate, vin, model, transmission, fuel, year, color, mileage
            )
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
            
            INSERT INTO clients (
              id, data, name, lastname, phone, email, fio, lang, category
            )
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

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('   ✓ Функция создана');

    // 3. Создать триггер
    console.log('\n3️⃣ Создание триггера...');
    await sql`
      CREATE TRIGGER process_booking_nested_entities_trigger
      BEFORE INSERT OR UPDATE ON bookings
      FOR EACH ROW
      EXECUTE FUNCTION process_booking_nested_entities();
    `;
    console.log('   ✓ Триггер создан');

    console.log('\n✅ Триггер успешно обновлён!');
    console.log('📝 Теперь триггер будет:');
    console.log('   1. Раскладывать поля БРОНИ (start_date, end_date, state, price, days, total, deposit)');
    console.log('   2. Извлекать car и client из booking.data');
    console.log('   3. Создавать/обновлять записи в cars и clients');
    console.log('   4. Устанавливать car_id и client_id в booking');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

updateTrigger();

