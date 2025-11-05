import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function fixTrigger() {
  console.log('🔧 Исправление триггера process_booking_nested_entities\n');
  console.log('Добавляю ON CONFLICT DO NOTHING для external_refs...\n');
  
  try {
    // Обновить триггер с ON CONFLICT
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
        -- Если data пустой или NULL, ничего не делаем
        IF NEW.data IS NULL OR NEW.data::TEXT = '{}' OR NEW.data::TEXT = 'null' THEN
          RETURN NEW;
        END IF;

        -- Если NEW.data является JSONB-строкой, преобразуем её в JSONB-объект
        IF jsonb_typeof(NEW.data) = 'string' THEN
          NEW.data := (NEW.data->>0)::JSONB;
        END IF;

        -- Извлекаем данные car и client
        car_data := NEW.data->'car';
        client_data := NEW.data->'client';

        -- Обработка car
        IF car_data IS NOT NULL AND car_data->>'id' IS NOT NULL THEN
          car_rentprog_id := car_data->>'id';
          
          -- Ищем существующий car через external_refs
          SELECT entity_id INTO car_uuid
          FROM external_refs
          WHERE system = 'rentprog' AND external_id = car_rentprog_id AND entity_type = 'car';
          
          IF car_uuid IS NULL THEN
            -- Создаём новый car
            car_uuid := gen_random_uuid();
            INSERT INTO cars (id, data)
            VALUES (car_uuid, car_data);
            
            -- Создаём external_ref с ON CONFLICT DO NOTHING
            INSERT INTO external_refs (entity_type, entity_id, system, external_id)
            VALUES ('car', car_uuid, 'rentprog', car_rentprog_id)
            ON CONFLICT (system, external_id) DO NOTHING;
          ELSE
            -- Обновляем существующий car
            UPDATE cars SET data = car_data WHERE id = car_uuid;
          END IF;
          
          -- Извлекаем поля для cars (если нужно)
          UPDATE cars
          SET 
            vin = COALESCE(car_data->>'vin', vin),
            model = COALESCE(car_data->>'car_name', model),
            number = COALESCE(car_data->>'number', number)
          WHERE id = car_uuid;
          
          NEW.car_id := car_uuid;
        END IF;

        -- Обработка client
        IF client_data IS NOT NULL AND client_data->>'id' IS NOT NULL THEN
          client_rentprog_id := client_data->>'id';
          
          -- Ищем существующий client через external_refs
          SELECT entity_id INTO client_uuid
          FROM external_refs
          WHERE system = 'rentprog' AND external_id = client_rentprog_id AND entity_type = 'client';
          
          IF client_uuid IS NULL THEN
            -- Создаём новый client
            client_uuid := gen_random_uuid();
            INSERT INTO clients (id, data)
            VALUES (client_uuid, client_data);
            
            -- Создаём external_ref с ON CONFLICT DO NOTHING
            INSERT INTO external_refs (entity_type, entity_id, system, external_id)
            VALUES ('client', client_uuid, 'rentprog', client_rentprog_id)
            ON CONFLICT (system, external_id) DO NOTHING;
          ELSE
            -- Обновляем существующий client
            UPDATE clients SET data = client_data WHERE id = client_uuid;
          END IF;
          
          -- Извлекаем поля для clients (если нужно)
          UPDATE clients
          SET 
            name = COALESCE(client_data->>'name', name),
            phone = COALESCE(client_data->>'phone', phone)
          WHERE id = client_uuid;
          
          NEW.client_id := client_uuid;
        END IF;

        -- Раскладываем поля самой брони
        IF NEW.data->>'start_date' IS NOT NULL OR NEW.data->>'start_date_formatted' IS NOT NULL THEN
          NEW.start_date := COALESCE(
            (NEW.data->>'start_date_formatted')::TIMESTAMPTZ,
            (NEW.data->>'start_date')::TIMESTAMPTZ
          );
        END IF;
        
        IF NEW.data->>'end_date' IS NOT NULL OR NEW.data->>'end_date_formatted' IS NOT NULL THEN
          NEW.end_date := COALESCE(
            (NEW.data->>'end_date_formatted')::TIMESTAMPTZ,
            (NEW.data->>'end_date')::TIMESTAMPTZ
          );
        END IF;
        
        NEW.state = COALESCE(NEW.data->>'state', NEW.state);
        
        -- Numeric поля с проверкой
        IF NEW.data->>'price' IS NOT NULL AND NEW.data->>'price' != '' THEN
          NEW.price := (NEW.data->>'price')::NUMERIC;
        END IF;
        
        IF NEW.data->>'days' IS NOT NULL AND NEW.data->>'days' != '' THEN
          NEW.days := (NEW.data->>'days')::NUMERIC;
        END IF;
        
        IF NEW.data->>'total' IS NOT NULL AND NEW.data->>'total' != '' THEN
          NEW.total := (NEW.data->>'total')::NUMERIC;
        END IF;
        
        IF NEW.data->>'deposit' IS NOT NULL AND NEW.data->>'deposit' != '' THEN
          NEW.deposit := (NEW.data->>'deposit')::NUMERIC;
        END IF;

        -- ВАЖНО: Очищаем data после обработки
        NEW.data := '{}'::jsonb;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('✅ Триггер обновлён!');
    console.log('\n📝 Изменения:');
    console.log('   - Добавлен ON CONFLICT DO NOTHING для external_refs');
    console.log('   - Триггер теперь не упадёт при повторных вставках');
    console.log('   - data очищается до {} после обработки\n');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

fixTrigger().catch(console.error);

