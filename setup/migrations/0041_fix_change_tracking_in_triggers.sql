-- =====================================================
-- Миграция 0041: Исправление отслеживания изменений в триггерах
-- =====================================================
-- Дата: 2025-01-20
-- Описание: Обновляем триггеры для заполнения полей отслеживания источника изменений
--           (updated_by_source, updated_by_user, updated_by_workflow и т.д.)

BEGIN;

-- =====================================================
-- 0. Удаление старых версий функций (если есть)
-- =====================================================

-- Удаляем все версии функции apply_history_changes (CASCADE удалит зависимости)
DROP FUNCTION IF EXISTS apply_history_changes CASCADE;

-- =====================================================
-- 1. Обновление функции apply_history_changes
-- =====================================================
-- Добавляем заполнение полей отслеживания при обновлении через history

CREATE OR REPLACE FUNCTION apply_history_changes(
  history_id BIGINT,
  entity_type_value TEXT,
  entity_id_value TEXT,
  operation_value TEXT,
  branch_code TEXT,
  raw_data_value JSONB,
  description_value TEXT,
  user_name_value TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  internal_uuid UUID;
  booking_uuid UUID;
  car_uuid UUID;
  client_uuid UUID;
  payment_uuid UUID;
  result BOOLEAN := FALSE;
BEGIN
  -- Пропускаем если нет entity_type или entity_id
  IF entity_type_value IS NULL OR entity_id_value IS NULL OR entity_id_value = '' THEN
    RETURN FALSE;
  END IF;
  
  -- Получаем внутренний UUID через external_refs
  SELECT entity_id INTO internal_uuid
  FROM external_refs
  WHERE system = 'rentprog' 
    AND external_id = entity_id_value 
    AND entity_type = entity_type_value
  LIMIT 1;
  
  -- Если не нашли UUID, пропускаем (сущность еще не создана в нашей БД)
  IF internal_uuid IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Применяем изменения в зависимости от типа сущности
  CASE entity_type_value
    WHEN 'booking' THEN
      -- Обновление брони (если есть изменения в raw_data)
      IF raw_data_value IS NOT NULL AND operation_value = 'update' THEN
        -- Здесь можно добавить логику обновления полей брони из raw_data
        -- Пока просто помечаем как обработанное
        result := TRUE;
      END IF;
      
    WHEN 'car' THEN
      -- Обновление авто (mileage, state, company_id и т.д.)
      IF raw_data_value IS NOT NULL AND operation_value = 'update' THEN
        -- Обновляем данные из raw_data с заполнением полей отслеживания
        UPDATE cars
        SET 
          updated_at = NOW(),
          data = COALESCE(data, '{}'::jsonb) || raw_data_value,
          -- Заполняем поля отслеживания изменений
          updated_by_source = 'rentprog_history',
          updated_by_workflow = NULL, -- history не приходит через workflow
          updated_by_function = 'apply_history_changes',
          updated_by_execution_id = history_id::TEXT, -- используем ID записи history как execution_id
          updated_by_user = user_name_value, -- автор из history
          updated_by_metadata = jsonb_build_object(
            'history_id', history_id,
            'branch', branch_code,
            'operation', operation_value,
            'description', description_value
          )
        WHERE id = internal_uuid;
        result := TRUE;
      END IF;
      
    WHEN 'client' THEN
      -- Обновление клиента
      IF raw_data_value IS NOT NULL AND operation_value = 'update' THEN
        UPDATE clients
        SET 
          updated_at = NOW(),
          data = COALESCE(data, '{}'::jsonb) || raw_data_value,
          -- Заполняем поля отслеживания изменений
          updated_by_source = 'rentprog_history',
          updated_by_workflow = NULL,
          updated_by_function = 'apply_history_changes',
          updated_by_execution_id = history_id::TEXT,
          updated_by_user = user_name_value,
          updated_by_metadata = jsonb_build_object(
            'history_id', history_id,
            'branch', branch_code,
            'operation', operation_value,
            'description', description_value
          )
        WHERE id = internal_uuid;
        result := TRUE;
      END IF;
      
    WHEN 'payment' THEN
      -- Платежи обрабатываются отдельно через payments таблицу
      -- Здесь можно добавить логику если нужно
      result := TRUE;
      
    ELSE
      -- Неизвестный тип сущности
      result := FALSE;
  END CASE;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION apply_history_changes IS 
  'Применение изменений из history к соответствующим таблицам с заполнением полей отслеживания источника изменений';

-- =====================================================
-- 2. Обновление триггера auto_process_history_trigger
-- =====================================================
-- Передаем user_name в функцию apply_history_changes

CREATE OR REPLACE FUNCTION auto_process_history_trigger()
RETURNS TRIGGER AS $$
DECLARE
  parsed RECORD;
  applied BOOLEAN;
  notes_text TEXT;
BEGIN
  -- Пропускаем уже обработанные записи
  IF NEW.processed = TRUE THEN
    RETURN NEW;
  END IF;
  
  -- Пропускаем если нет description
  IF NEW.description IS NULL OR NEW.description = '' THEN
    RETURN NEW;
  END IF;
  
  -- Парсим description
  SELECT * INTO parsed
  FROM parse_history_description(NEW.description)
  LIMIT 1;
  
  -- Если не удалось распарсить, оставляем необработанным
  IF parsed.entity_type IS NULL OR parsed.entity_id IS NULL THEN
    NEW.notes := COALESCE(NEW.notes, '') || ' | Не удалось распарсить description';
    RETURN NEW;
  END IF;
  
  -- Обновляем entity_type и entity_id если они пустые
  IF NEW.entity_type IS NULL THEN
    NEW.entity_type := parsed.entity_type;
  END IF;
  
  IF NEW.entity_id IS NULL THEN
    NEW.entity_id := parsed.entity_id;
  END IF;
  
  -- Обновляем user_name если пустой
  IF NEW.user_name IS NULL AND parsed.user_name IS NOT NULL THEN
    NEW.user_name := parsed.user_name;
  END IF;
  
  -- Применяем изменения к таблицам (передаем user_name)
  applied := apply_history_changes(
    NEW.id,
    parsed.entity_type,
    parsed.entity_id,
    parsed.operation,
    NEW.branch,
    NEW.raw_data,
    NEW.description,
    COALESCE(NEW.user_name, parsed.user_name) -- передаем user_name
  );
  
  -- Если изменения применены успешно, помечаем как обработанное
  IF applied THEN
    NEW.processed := TRUE;
    NEW.notes := COALESCE(NEW.notes, '') || ' | Обработано автоматически через триггер';
  ELSE
    -- Оставляем необработанным для ручной обработки
    notes_text := ' | Парсинг успешен, но изменения не применены (сущность не найдена в БД?)';
    NEW.notes := COALESCE(NEW.notes, '') || notes_text;
  END IF;
  
  -- Отправляем уведомление для асинхронной обработки (если нужно)
  PERFORM pg_notify(
    'history_item_processed',
    NEW.id::TEXT || '|' || 
    NEW.branch || '|' || 
    COALESCE(parsed.entity_type, 'unknown') || '|' || 
    COALESCE(parsed.entity_id, '')
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_process_history_trigger() IS 
  'Триггер для автоматической обработки записей history с парсингом description и применением изменений (с заполнением полей отслеживания)';

-- =====================================================
-- 3. Обновление функции process_booking_nested_entities
-- =====================================================
-- Добавляем заполнение полей отслеживания при обновлении cars и clients через триггер bookings

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
    NEW.start_at := (NEW.data->>'start_date_formatted')::TIMESTAMPTZ;
  ELSIF NEW.data->'start_date' IS NOT NULL THEN
    -- Парсим формат "10-11-2025 1:30"
    BEGIN
      NEW.start_at := to_timestamp(NEW.data->>'start_date', 'DD-MM-YYYY HH24:MI')::TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN
      -- Если парсинг не удался, пропускаем
      NULL;
    END;
  END IF;

  IF NEW.data->'end_date_formatted' IS NOT NULL THEN
    NEW.end_at := (NEW.data->>'end_date_formatted')::TIMESTAMPTZ;
  ELSIF NEW.data->'end_date' IS NOT NULL THEN
    BEGIN
      NEW.end_at := to_timestamp(NEW.data->>'end_date', 'DD-MM-YYYY HH24:MI')::TIMESTAMPTZ;
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
        id, data, rentprog_id, plate, vin, model, transmission, fuel, year, color, mileage,
        -- Заполняем поля отслеживания изменений
        updated_by_source, updated_by_workflow, updated_by_function, updated_by_execution_id, updated_by_metadata
      )
      VALUES (
        car_uuid, car_data, car_rentprog_id, car_data->>'number', car_data->>'vin', 
        car_data->>'car_name', car_data->>'transmission', car_data->>'fuel', 
        (car_data->>'year')::INTEGER, car_data->>'color', (car_data->>'mileage')::INTEGER,
        'trigger', -- источник: триггер
        NULL, -- workflow не определен для триггера
        'process_booking_nested_entities', -- функция
        NEW.id::TEXT, -- используем ID брони как execution_id
        jsonb_build_object(
          'trigger_type', 'booking_nested_entities',
          'booking_id', NEW.id,
          'booking_rentprog_id', COALESCE(NEW.rentprog_id::TEXT, 'unknown')
        )
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
        updated_at = NOW(),
        -- Заполняем поля отслеживания изменений
        updated_by_source = 'trigger',
        updated_by_workflow = NULL,
        updated_by_function = 'process_booking_nested_entities',
        updated_by_execution_id = NEW.id::TEXT,
        updated_by_metadata = jsonb_build_object(
          'trigger_type', 'booking_nested_entities',
          'booking_id', NEW.id,
          'booking_rentprog_id', COALESCE(NEW.rentprog_id::TEXT, 'unknown')
        )
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
        id, data, name, lastname, phone, email, fio, lang, category,
        -- Заполняем поля отслеживания изменений
        updated_by_source, updated_by_workflow, updated_by_function, updated_by_execution_id, updated_by_metadata
      )
      VALUES (
        client_uuid, client_data,
        client_data->>'name', client_data->>'lastname', client_data->>'phone',
        client_data->>'email', client_data->>'fio', client_data->>'lang',
        client_data->>'category',
        'trigger', -- источник: триггер
        NULL,
        'process_booking_nested_entities',
        NEW.id::TEXT,
        jsonb_build_object(
          'trigger_type', 'booking_nested_entities',
          'booking_id', NEW.id,
          'booking_rentprog_id', COALESCE(NEW.rentprog_id::TEXT, 'unknown')
        )
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
        updated_at = NOW(),
        -- Заполняем поля отслеживания изменений
        updated_by_source = 'trigger',
        updated_by_workflow = NULL,
        updated_by_function = 'process_booking_nested_entities',
        updated_by_execution_id = NEW.id::TEXT,
        updated_by_metadata = jsonb_build_object(
          'trigger_type', 'booking_nested_entities',
          'booking_id', NEW.id,
          'booking_rentprog_id', COALESCE(NEW.rentprog_id::TEXT, 'unknown')
        )
      WHERE id = client_uuid;
    END IF;
    
    NEW.client_id := client_uuid;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_booking_nested_entities() IS 
  'Триггер для обработки вложенных сущностей (car, client) в bookings с заполнением полей отслеживания изменений';

COMMIT;

