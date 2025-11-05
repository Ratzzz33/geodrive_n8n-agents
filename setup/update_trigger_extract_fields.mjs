#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function updateTrigger() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n🔧 Обновление триггера для раскладки данных по полям...\n');

  try {
    // 1. Удалить старый триггер
    console.log('1️⃣ Удаление старого триггера...');
    await sql`DROP TRIGGER IF EXISTS process_booking_nested_entities_trigger ON bookings;`;
    await sql`DROP FUNCTION IF EXISTS process_booking_nested_entities();`;
    console.log('   ✓ Старый триггер удалён');

    // 2. Создать новую функцию триггера с раскладкой по полям
    console.log('\n2️⃣ Создание новой функции триггера...');
    await sql`
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
        -- Проверяем, есть ли data->car и data->client
        IF NEW.data IS NULL THEN
          RETURN NEW;
        END IF;

        car_data := NEW.data->'car';
        client_data := NEW.data->'client';

        -- ========== ОБРАБОТКА CAR ==========
        IF car_data IS NOT NULL AND car_data->>'id' IS NOT NULL THEN
          car_rentprog_id := car_data->>'id';
          
          -- Проверяем, есть ли уже car в external_refs
          SELECT entity_id INTO car_uuid
          FROM external_refs
          WHERE system = 'rentprog' AND external_id = car_rentprog_id AND entity_type = 'car';
          
          IF car_uuid IS NULL THEN
            -- Создаём новую машину с раскладкой по полям
            car_uuid := gen_random_uuid();
            
            INSERT INTO cars (
              id, data, 
              rentprog_id, plate, vin, model, transmission, fuel, year, color, mileage,
              car_type, interior, car_class, code, state, avatar_url, drive_unit,
              number_doors, number_seats, steering_side, engine_capacity, engine_power,
              tire_size, tire_type, franchise, max_fine, start_mileage, 
              registration_certificate, is_air, parktronic_camera, tank_state,
              clean_state, audio_system, is_electropackage, tank_value, gas_mileage,
              repair_cost, pts, roof, custom_field_1, custom_field_2, custom_field_3,
              window_lifters, body_number, airbags, company_id, description, sipp,
              sort, active, number, deposit, car_name, age_limit, price_hour,
              investor_id, car_mark_id, car_model_id, average_price, purchase_date,
              ygibdd_active, ygibdd_status, hourly_deposit, purchase_price,
              weekly_deposit, monthly_deposit, car_generation_id, driver_year_limit,
              inspections_count, rided_bookings_count, active_bookings_count,
              car_complectation_id, car_configuration_id, main_company_id
            )
            VALUES (
              car_uuid, car_data,
              car_rentprog_id, car_data->>'number', car_data->>'vin', car_data->>'car_name',
              car_data->>'transmission', car_data->>'fuel', (car_data->>'year')::INTEGER,
              car_data->>'color', (car_data->>'mileage')::INTEGER, car_data->>'car_type',
              car_data->>'interior', car_data->>'car_class', car_data->>'code',
              (car_data->>'state')::INTEGER, car_data->>'avatar_url', car_data->>'drive_unit',
              (car_data->>'number_doors')::INTEGER, (car_data->>'number_seats')::INTEGER,
              car_data->>'steering_side', car_data->>'engine_capacity', car_data->>'engine_power',
              car_data->>'tire_size', (car_data->>'tire_type')::INTEGER,
              (car_data->>'franchise')::INTEGER, (car_data->>'max_fine')::INTEGER,
              (car_data->>'start_mileage')::INTEGER, car_data->>'registration_certificate',
              (car_data->>'is_air')::BOOLEAN, (car_data->>'parktronic_camera')::BOOLEAN,
              (car_data->>'tank_state')::BOOLEAN, (car_data->>'clean_state')::BOOLEAN,
              (car_data->>'audio_system')::BOOLEAN, (car_data->>'is_electropackage')::BOOLEAN,
              (car_data->>'tank_value')::INTEGER, car_data->>'gas_mileage',
              (car_data->>'repair_cost')::INTEGER, car_data->>'pts', car_data->>'roof',
              car_data->>'custom_field_1', car_data->>'custom_field_2',
              car_data->>'custom_field_3', car_data->>'window_lifters', car_data->>'body_number',
              car_data->>'airbags', (car_data->>'company_id')::INTEGER, car_data->>'description',
              car_data->>'sipp', (car_data->>'sort')::BIGINT, (car_data->>'active')::BOOLEAN,
              car_data->>'number', (car_data->>'deposit')::BIGINT, car_data->>'car_name',
              (car_data->>'age_limit')::BIGINT, (car_data->>'price_hour')::BIGINT,
              (car_data->>'investor_id')::BIGINT, (car_data->>'car_mark_id')::BIGINT,
              (car_data->>'car_model_id')::BIGINT, (car_data->>'average_price')::NUMERIC,
              car_data->>'purchase_date', (car_data->>'ygibdd_active')::BOOLEAN,
              (car_data->>'ygibdd_status')::BIGINT, (car_data->>'hourly_deposit')::BIGINT,
              (car_data->>'purchase_price')::BIGINT, (car_data->>'weekly_deposit')::BIGINT,
              (car_data->>'monthly_deposit')::BIGINT, (car_data->>'car_generation_id')::BIGINT,
              (car_data->>'driver_year_limit')::BIGINT, (car_data->>'inspections_count')::BIGINT,
              (car_data->>'rided_bookings_count')::BIGINT, (car_data->>'active_bookings_count')::BIGINT,
              car_data->>'car_complectation_id', (car_data->>'car_configuration_id')::BIGINT,
              (car_data->>'main_company_id')::BIGINT
            );
            
            -- Создаём external_ref
            INSERT INTO external_refs (entity_type, entity_id, system, external_id)
            VALUES ('car', car_uuid, 'rentprog', car_rentprog_id);
          ELSE
            -- Обновляем существующую машину с раскладкой по полям
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
              car_type = car_data->>'car_type',
              interior = car_data->>'interior',
              car_class = car_data->>'car_class',
              code = car_data->>'code',
              state = (car_data->>'state')::INTEGER,
              avatar_url = car_data->>'avatar_url',
              drive_unit = car_data->>'drive_unit',
              number_doors = (car_data->>'number_doors')::INTEGER,
              number_seats = (car_data->>'number_seats')::INTEGER,
              steering_side = car_data->>'steering_side',
              engine_capacity = car_data->>'engine_capacity',
              engine_power = car_data->>'engine_power',
              tire_size = car_data->>'tire_size',
              tire_type = (car_data->>'tire_type')::INTEGER,
              franchise = (car_data->>'franchise')::INTEGER,
              max_fine = (car_data->>'max_fine')::INTEGER,
              start_mileage = (car_data->>'start_mileage')::INTEGER,
              registration_certificate = car_data->>'registration_certificate',
              updated_at = NOW()
            WHERE id = car_uuid;
          END IF;
          
          -- Устанавливаем car_id в booking
          NEW.car_id := car_uuid;
        END IF;

        -- ========== ОБРАБОТКА CLIENT ==========
        IF client_data IS NOT NULL AND client_data->>'id' IS NOT NULL THEN
          client_rentprog_id := client_data->>'id';
          
          SELECT entity_id INTO client_uuid
          FROM external_refs
          WHERE system = 'rentprog' AND external_id = client_rentprog_id AND entity_type = 'client';
          
          IF client_uuid IS NULL THEN
            -- Создаём нового клиента с раскладкой по полям
            client_uuid := gen_random_uuid();
            
            INSERT INTO clients (
              id, data,
              name, lastname, phone, email, notes, telegram, whatsapp,
              company_id, vip_status, fio, lang, entity, source, address,
              country, birthday, category, middlename, entity_name, entity_phone,
              driver_issued, driver_number, driver_series, passport_issued,
              passport_number, passport_series, ogrn, balance, acc_number,
              created_from_api
            )
            VALUES (
              client_uuid, client_data,
              client_data->>'name', client_data->>'lastname', client_data->>'phone',
              client_data->>'email', client_data->>'notes', client_data->>'telegram',
              client_data->>'whatsapp', (client_data->>'company_id')::INTEGER,
              (client_data->>'vip_status')::BOOLEAN, client_data->>'fio',
              client_data->>'lang', (client_data->>'entity')::BOOLEAN,
              client_data->>'source', client_data->>'address', client_data->>'country',
              client_data->>'birthday', client_data->>'category', client_data->>'middlename',
              client_data->>'entity_name', client_data->>'entity_phone',
              client_data->>'driver_issued', client_data->>'driver_number',
              client_data->>'driver_series', client_data->>'passport_issued',
              client_data->>'passport_number', client_data->>'passport_series',
              client_data->>'ogrn', (client_data->>'balance')::INTEGER,
              client_data->>'acc_number', (client_data->>'created_from_api')::BOOLEAN
            );
            
            INSERT INTO external_refs (entity_type, entity_id, system, external_id)
            VALUES ('client', client_uuid, 'rentprog', client_rentprog_id);
          ELSE
            -- Обновляем существующего клиента с раскладкой по полям
            UPDATE clients SET
              data = client_data,
              name = client_data->>'name',
              lastname = client_data->>'lastname',
              phone = client_data->>'phone',
              email = client_data->>'email',
              notes = client_data->>'notes',
              telegram = client_data->>'telegram',
              whatsapp = client_data->>'whatsapp',
              fio = client_data->>'fio',
              lang = client_data->>'lang',
              category = client_data->>'category',
              middlename = client_data->>'middlename',
              updated_at = NOW()
            WHERE id = client_uuid;
          END IF;
          
          NEW.client_id := client_uuid;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;
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
    console.log('   1. Извлекать car и client из booking.data');
    console.log('   2. Раскладывать данные по полям таблиц (name, phone, vin, etc.)');
    console.log('   3. Сохранять полные данные в поле data (JSONB)');
    console.log('   4. Устанавливать car_id и client_id в booking');

  } catch (error) {
    console.error('❌ Ошибка при обновлении триггера:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

updateTrigger();

