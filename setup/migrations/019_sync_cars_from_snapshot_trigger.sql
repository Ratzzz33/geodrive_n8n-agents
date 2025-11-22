-- Триггер для автоматического раскладывания данных из rentprog_car_states_snapshot
-- в таблицу cars и external_refs при сохранении snapshot
--
-- Как работает:
-- 1. При INSERT/UPDATE в rentprog_car_states_snapshot триггер автоматически:
--    - Извлекает данные из поля data (JSON) или собирает из отдельных полей
--    - Делает UPSERT в таблицу cars по rentprog_id
--    - Создает/обновляет запись в external_refs для привязки броней
--    - Очищает поле data для визуального контроля (автоматически)
--
-- Преимущества:
-- - Автоматическая синхронизация cars и external_refs
-- - Брони могут привязываться к машинам через rentprog_id
-- - Поле data можно очистить для визуального контроля
-- - Не нужно отдельной ноды "Sync Cars" в workflow

BEGIN;

-- Функция триггера: синхронизация cars и external_refs из snapshot
CREATE OR REPLACE FUNCTION sync_cars_from_snapshot()
RETURNS trigger AS $$
DECLARE
  car_uuid uuid;
  car_data jsonb;
BEGIN
  -- Пропускаем если нет rentprog_id
  IF NEW.rentprog_id IS NULL OR NEW.rentprog_id = '' THEN
    RETURN NEW;
  END IF;

  -- Используем data если есть, иначе собираем из полей
  IF NEW.data IS NOT NULL AND jsonb_typeof(NEW.data) = 'object' THEN
    car_data := NEW.data;
  ELSE
    -- Собираем data из полей snapshot
    car_data := jsonb_build_object(
      'id', NEW.rentprog_id::integer,
      'car_name', NEW.car_name,
      'code', NEW.code,
      'number', NEW.number,
      'vin', NEW.vin,
      'color', NEW.color,
      'year', NEW.year,
      'transmission', NEW.transmission,
      'fuel', NEW.fuel,
      'car_type', NEW.car_type,
      'car_class', NEW.car_class,
      'active', NEW.active,
      'state', NEW.state,
      'tank_state', NEW.tank_state,
      'clean_state', NEW.clean_state,
      'mileage', NEW.mileage,
      'tire_type', NEW.tire_type,
      'tire_size', NEW.tire_size,
      'last_inspection', NEW.last_inspection,
      'deposit', NEW.deposit,
      'price_hour', NEW.price_hour,
      'hourly_deposit', NEW.hourly_deposit,
      'monthly_deposit', NEW.monthly_deposit,
      'investor_id', NEW.investor_id,
      'purchase_price', NEW.purchase_price,
      'purchase_date', NEW.purchase_date,
      'age_limit', NEW.age_limit,
      'driver_year_limit', NEW.driver_year_limit,
      'franchise', NEW.franchise,
      'max_fine', NEW.max_fine,
      'repair_cost', NEW.repair_cost,
      'is_air', NEW.is_air,
      'climate_control', NEW.climate_control,
      'parktronic', NEW.parktronic,
      'parktronic_camera', NEW.parktronic_camera,
      'heated_seats', NEW.heated_seats,
      'audio_system', NEW.audio_system,
      'usb_system', NEW.usb_system,
      'rain_sensor', NEW.rain_sensor,
      'engine_capacity', NEW.engine_capacity,
      'number_doors', NEW.number_doors,
      'tank_value', NEW.tank_value,
      'pts', NEW.pts,
      'registration_certificate', NEW.registration_certificate,
      'body_number', NEW.body_number,
      'company_id', NEW.company_id
    );
  END IF;

  -- UPSERT в cars по rentprog_id
  INSERT INTO cars (
    branch_id,
    rentprog_id,
    plate,
    vin,
    model,
    data,
    updated_at
  )
  VALUES (
    NEW.branch_id,
    NEW.rentprog_id,
    NULLIF(NEW.number, ''),
    NULLIF(NEW.vin, ''),
    NULLIF(NEW.car_name, ''),
    car_data,
    NOW()
  )
  ON CONFLICT (rentprog_id)
  DO UPDATE SET
    branch_id = EXCLUDED.branch_id,
    plate = EXCLUDED.plate,
    vin = EXCLUDED.vin,
    model = EXCLUDED.model,
    data = EXCLUDED.data,
    updated_at = NOW()
  RETURNING id INTO car_uuid;

  -- Если не нашли существующую машину, получаем ID из только что созданной
  IF car_uuid IS NULL THEN
    SELECT id INTO car_uuid
    FROM cars
    WHERE rentprog_id = NEW.rentprog_id
    LIMIT 1;
  END IF;

  -- Создаем/обновляем запись в external_refs
  IF car_uuid IS NOT NULL THEN
    INSERT INTO external_refs (
      entity_type,
      entity_id,
      system,
      external_id,
      updated_at
    )
    VALUES (
      'car',
      car_uuid,
      'rentprog',
      NEW.rentprog_id,
      NOW()
    )
    ON CONFLICT (system, external_id)
    DO UPDATE SET
      entity_type = EXCLUDED.entity_type,
      entity_id = EXCLUDED.entity_id,
      updated_at = NOW();
  END IF;

  -- Очищаем поле data для визуального контроля (автоматически)
  -- Используем UPDATE только если data было заполнено, чтобы избежать рекурсии
  -- (UPDATE с data = NULL не вызовет триггер снова, т.к. условие WHEN проверяет NEW.data IS NOT NULL)
  IF NEW.data IS NOT NULL THEN
    UPDATE rentprog_car_states_snapshot
    SET data = NULL
    WHERE rentprog_id = NEW.rentprog_id
      AND data IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер AFTER для синхронизации cars и external_refs
-- Триггер автоматически очищает поле data после обработки
-- Условие WHEN предотвращает рекурсивный вызов при UPDATE с data = NULL
DROP TRIGGER IF EXISTS trg_sync_cars_from_snapshot ON rentprog_car_states_snapshot;
CREATE TRIGGER trg_sync_cars_from_snapshot
AFTER INSERT OR UPDATE ON rentprog_car_states_snapshot
FOR EACH ROW
WHEN (
  -- Выполняем триггер только если data не NULL (чтобы избежать рекурсии при очистке)
  -- При INSERT data всегда не NULL (из workflow)
  -- При UPDATE других полей триггер не вызовется, но это нормально - данные уже синхронизированы
  NEW.data IS NOT NULL
)
EXECUTE FUNCTION sync_cars_from_snapshot();

COMMIT;

