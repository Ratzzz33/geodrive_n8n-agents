-- 1) Расширяем таблицу cars дополнительными колонками под основные поля из data
ALTER TABLE cars ADD COLUMN IF NOT EXISTS transmission TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS fuel TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS year INT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS mileage INT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS car_type TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS interior TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS car_class TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS state INT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS drive_unit TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS number_doors INT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS number_seats INT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS trunk_volume TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS steering_side TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS engine_capacity TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS engine_power TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS tire_size TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS tire_type INT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS franchise INT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS max_fine INT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS insurance TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS start_mileage INT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS registration_certificate TEXT;

-- Бинарные флаги
ALTER TABLE cars ADD COLUMN IF NOT EXISTS abs BOOLEAN;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS ebd BOOLEAN;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS esp BOOLEAN;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS is_air BOOLEAN;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS cd_system BOOLEAN;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS tv_system BOOLEAN;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS parktronic BOOLEAN;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS parktronic_back BOOLEAN;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS parktronic_camera BOOLEAN;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS tank_state BOOLEAN;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS heated_seats BOOLEAN;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS heated_seats_front BOOLEAN;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS clean_state BOOLEAN;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS audio_system BOOLEAN;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS video_system BOOLEAN;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS folding_seats BOOLEAN;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS climate_control BOOLEAN;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS usb_system BOOLEAN;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS rain_sensor BOOLEAN;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS wheel_adjustment BOOLEAN;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS wheel_adjustment_full BOOLEAN;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS heated_windshield BOOLEAN;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS is_electropackage BOOLEAN;

-- Прочие параметры
ALTER TABLE cars ADD COLUMN IF NOT EXISTS tank_value INT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS gas_mileage TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS repair_cost INT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS store_place TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS pts TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS roof TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS custom_field_1 TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS custom_field_2 TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS custom_field_3 TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS window_lifters TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS extra_mileage_km INT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS extra_mileage_price INT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS body_number TEXT;

-- 2) Функция синхронизации колонок из JSONB data
CREATE OR REPLACE FUNCTION cars_sync_from_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Основные
  NEW.rentprog_id := COALESCE(NEW.rentprog_id, NEW.data->>'id');
  NEW.model := COALESCE(NEW.model, NULLIF(NEW.data->>'car_name','null'));
  NEW.transmission := NULLIF(NEW.data->>'transmission','null');
  NEW.fuel := NULLIF(NEW.data->>'fuel','null');
  NEW.year := CASE WHEN (NEW.data->>'year') ~ '^[0-9]+$' THEN (NEW.data->>'year')::int END;
  NEW.color := NULLIF(NEW.data->>'color','null');
  NEW.mileage := CASE WHEN (NEW.data->>'mileage') ~ '^[0-9]+$' THEN (NEW.data->>'mileage')::int END;
  NEW.car_type := NULLIF(NEW.data->>'car_type','null');
  NEW.interior := NULLIF(NEW.data->>'interior','null');
  NEW.car_class := NULLIF(NEW.data->>'car_class','null');
  NEW.code := NULLIF(NEW.data->>'code','null');
  NEW.state := CASE WHEN (NEW.data->>'state') ~ '^[0-9]+$' THEN (NEW.data->>'state')::int END;
  NEW.avatar_url := NULLIF(NEW.data->>'avatar_url','null');
  NEW.drive_unit := NULLIF(NEW.data->>'drive_unit','null');
  NEW.number_doors := CASE WHEN (NEW.data->>'number_doors') ~ '^[0-9]+$' THEN (NEW.data->>'number_doors')::int END;
  NEW.number_seats := CASE WHEN (NEW.data->>'number_seats') ~ '^[0-9]+$' THEN (NEW.data->>'number_seats')::int END;
  NEW.trunk_volume := NULLIF(NEW.data->>'trunk_volume','null');
  NEW.steering_side := NULLIF(NEW.data->>'steering_side','null');
  NEW.engine_capacity := NULLIF(NEW.data->>'engine_capacity','null');
  NEW.engine_power := NULLIF(NEW.data->>'engine_power','null');
  NEW.tire_size := NULLIF(NEW.data->>'tire_size','null');
  NEW.tire_type := CASE WHEN (NEW.data->>'tire_type') ~ '^[0-9]+$' THEN (NEW.data->>'tire_type')::int END;
  NEW.franchise := CASE WHEN (NEW.data->>'franchise') ~ '^[0-9]+$' THEN (NEW.data->>'franchise')::int END;
  NEW.max_fine := CASE WHEN (NEW.data->>'max_fine') ~ '^[0-9]+$' THEN (NEW.data->>'max_fine')::int END;
  NEW.insurance := NULLIF(NEW.data->>'insurance','null');
  NEW.start_mileage := CASE WHEN (NEW.data->>'start_mileage') ~ '^[0-9]+$' THEN (NEW.data->>'start_mileage')::int END;
  NEW.registration_certificate := NULLIF(NEW.data->>'registration_certificate','null');

  -- Флаги
  NEW.abs := CASE WHEN (NEW.data->>'abs') IN ('true','1','t') THEN TRUE WHEN (NEW.data->>'abs') IN ('false','0','f') THEN FALSE ELSE NEW.abs END;
  NEW.ebd := CASE WHEN (NEW.data->>'ebd') IN ('true','1','t') THEN TRUE WHEN (NEW.data->>'ebd') IN ('false','0','f') THEN FALSE ELSE NEW.ebd END;
  NEW.esp := CASE WHEN (NEW.data->>'esp') IN ('true','1','t') THEN TRUE WHEN (NEW.data->>'esp') IN ('false','0','f') THEN FALSE ELSE NEW.esp END;
  NEW.is_air := CASE WHEN (NEW.data->>'is_air') IN ('true','1','t') THEN TRUE WHEN (NEW.data->>'is_air') IN ('false','0','f') THEN FALSE ELSE NEW.is_air END;
  NEW.cd_system := CASE WHEN (NEW.data->>'cd_system') IN ('true','1','t') THEN TRUE WHEN (NEW.data->>'cd_system') IN ('false','0','f') THEN FALSE ELSE NEW.cd_system END;
  NEW.tv_system := CASE WHEN (NEW.data->>'tv_system') IN ('true','1','t') THEN TRUE WHEN (NEW.data->>'tv_system') IN ('false','0','f') THEN FALSE ELSE NEW.tv_system END;
  NEW.parktronic := CASE WHEN (NEW.data->>'parktronic') IN ('true','1','t') THEN TRUE WHEN (NEW.data->>'parktronic') IN ('false','0','f') THEN FALSE ELSE NEW.parktronic END;
  NEW.parktronic_back := CASE WHEN (NEW.data->>'parktronic_back') IN ('true','1','t') THEN TRUE WHEN (NEW.data->>'parktronic_back') IN ('false','0','f') THEN FALSE ELSE NEW.parktronic_back END;
  NEW.parktronic_camera := CASE WHEN (NEW.data->>'parktronic_camera') IN ('true','1','t') THEN TRUE WHEN (NEW.data->>'parktronic_camera') IN ('false','0','f') THEN FALSE ELSE NEW.parktronic_camera END;
  NEW.tank_state := CASE WHEN (NEW.data->>'tank_state') IN ('true','1','t') THEN TRUE WHEN (NEW.data->>'tank_state') IN ('false','0','f') THEN FALSE ELSE NEW.tank_state END;
  NEW.heated_seats := CASE WHEN (NEW.data->>'heated_seats') IN ('true','1','t') THEN TRUE WHEN (NEW.data->>'heated_seats') IN ('false','0','f') THEN FALSE ELSE NEW.heated_seats END;
  NEW.heated_seats_front := CASE WHEN (NEW.data->>'heated_seats_front') IN ('true','1','t') THEN TRUE WHEN (NEW.data->>'heated_seats_front') IN ('false','0','f') THEN FALSE ELSE NEW.heated_seats_front END;
  NEW.clean_state := CASE WHEN (NEW.data->>'clean_state') IN ('true','1','t') THEN TRUE WHEN (NEW.data->>'clean_state') IN ('false','0','f') THEN FALSE ELSE NEW.clean_state END;
  NEW.audio_system := CASE WHEN (NEW.data->>'audio_system') IN ('true','1','t') THEN TRUE WHEN (NEW.data->>'audio_system') IN ('false','0','f') THEN FALSE ELSE NEW.audio_system END;
  NEW.video_system := CASE WHEN (NEW.data->>'video_system') IN ('true','1','t') THEN TRUE WHEN (NEW.data->>'video_system') IN ('false','0','f') THEN FALSE ELSE NEW.video_system END;
  NEW.folding_seats := CASE WHEN (NEW.data->>'folding_seats') IN ('true','1','t') THEN TRUE WHEN (NEW.data->>'folding_seats') IN ('false','0','f') THEN FALSE ELSE NEW.folding_seats END;
  NEW.climate_control := CASE WHEN (NEW.data->>'climate_control') IN ('true','1','t') THEN TRUE WHEN (NEW.data->>'climate_control') IN ('false','0','f') THEN FALSE ELSE NEW.climate_control END;
  NEW.usb_system := CASE WHEN (NEW.data->>'usb_system') IN ('true','1','t') THEN TRUE WHEN (NEW.data->>'usb_system') IN ('false','0','f') THEN FALSE ELSE NEW.usb_system END;
  NEW.rain_sensor := CASE WHEN (NEW.data->>'rain_sensor') IN ('true','1','t') THEN TRUE WHEN (NEW.data->>'rain_sensor') IN ('false','0','f') THEN FALSE ELSE NEW.rain_sensor END;
  NEW.wheel_adjustment := CASE WHEN (NEW.data->>'wheel_adjustment') IN ('true','1','t') THEN TRUE WHEN (NEW.data->>'wheel_adjustment') IN ('false','0','f') THEN FALSE ELSE NEW.wheel_adjustment END;
  NEW.wheel_adjustment_full := CASE WHEN (NEW.data->>'wheel_adjustment_full') IN ('true','1','t') THEN TRUE WHEN (NEW.data->>'wheel_adjustment_full') IN ('false','0','f') THEN FALSE ELSE NEW.wheel_adjustment_full END;
  NEW.heated_windshield := CASE WHEN (NEW.data->>'heated_windshield') IN ('true','1','t') THEN TRUE WHEN (NEW.data->>'heated_windshield') IN ('false','0','f') THEN FALSE ELSE NEW.heated_windshield END;
  NEW.is_electropackage := CASE WHEN (NEW.data->>'is_electropackage') IN ('true','1','t') THEN TRUE WHEN (NEW.data->>'is_electropackage') IN ('false','0','f') THEN FALSE ELSE NEW.is_electropackage END;

  -- Прочие
  NEW.tank_value := CASE WHEN (NEW.data->>'tank_value') ~ '^[0-9]+$' THEN (NEW.data->>'tank_value')::int END;
  NEW.gas_mileage := NULLIF(NEW.data->>'gas_mileage','null');
  NEW.repair_cost := CASE WHEN (NEW.data->>'repair_cost') ~ '^[0-9]+$' THEN (NEW.data->>'repair_cost')::int END;
  NEW.store_place := NULLIF(NEW.data->>'store_place','null');
  NEW.pts := NULLIF(NEW.data->>'pts','null');
  NEW.roof := NULLIF(NEW.data->>'roof','null');
  NEW.custom_field_1 := NULLIF(NEW.data->>'custom_field_1','null');
  NEW.custom_field_2 := NULLIF(NEW.data->>'custom_field_2','null');
  NEW.custom_field_3 := NULLIF(NEW.data->>'custom_field_3','null');
  NEW.window_lifters := NULLIF(NEW.data->>'window_lifters','null');
  NEW.extra_mileage_km := CASE WHEN (NEW.data->>'extra_mileage_km') ~ '^[0-9]+$' THEN (NEW.data->>'extra_mileage_km')::int END;
  NEW.extra_mileage_price := CASE WHEN (NEW.data->>'extra_mileage_price') ~ '^[0-9]+$' THEN (NEW.data->>'extra_mileage_price')::int END;
  NEW.body_number := NULLIF(NEW.data->>'body_number','null');

  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- 3) Триггер
DROP TRIGGER IF EXISTS trg_cars_sync_from_data ON cars;
CREATE TRIGGER trg_cars_sync_from_data
BEFORE INSERT OR UPDATE OF data ON cars
FOR EACH ROW
EXECUTE FUNCTION cars_sync_from_data();

-- 4) Одноразовая инициализация (backfill) для существующих записей
UPDATE cars SET data = data;


