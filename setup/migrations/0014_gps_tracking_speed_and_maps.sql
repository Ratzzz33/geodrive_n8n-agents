-- Миграция: Добавление полей speed и google_maps_link в gps_tracking
-- Дата: 2025-11-09

-- Создаем таблицу gps_tracking если её ещё нет
CREATE TABLE IF NOT EXISTS gps_tracking (
  id BIGSERIAL PRIMARY KEY,
  car_id UUID UNIQUE NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  starline_device_id BIGINT,
  starline_alias TEXT,
  
  -- Текущие координаты
  current_lat NUMERIC(10, 8),
  current_lng NUMERIC(11, 8),
  current_sat_qty INT,
  current_timestamp TIMESTAMPTZ,
  
  -- Предыдущие координаты (для вычисления движения)
  previous_lat NUMERIC(10, 8),
  previous_lng NUMERIC(11, 8),
  previous_sat_qty INT,
  previous_timestamp TIMESTAMPTZ,
  
  -- Статус и движение
  status TEXT, -- 'offline', 'gps_offline', 'moving', 'parked_on', 'parked_off'
  is_moving BOOLEAN DEFAULT FALSE,
  distance_moved NUMERIC(10, 2) DEFAULT 0, -- в метрах
  
  -- GPS и связь
  gps_level INT DEFAULT 0,
  gsm_level INT DEFAULT 0,
  
  -- Состояние автомобиля
  ignition_on BOOLEAN DEFAULT FALSE,
  engine_running BOOLEAN DEFAULT FALSE,
  parking_brake BOOLEAN DEFAULT FALSE,
  battery_voltage NUMERIC(5, 2),
  
  -- Метаданные
  last_activity TIMESTAMPTZ,
  last_sync TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Добавляем поля speed и google_maps_link если их ещё нет
DO $$
BEGIN
  -- Добавить поле speed
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gps_tracking' AND column_name = 'speed'
  ) THEN
    ALTER TABLE gps_tracking ADD COLUMN speed NUMERIC(6, 2) DEFAULT 0;
    COMMENT ON COLUMN gps_tracking.speed IS 'Скорость в км/ч от Starline';
  END IF;
  
  -- Добавить поле google_maps_link
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gps_tracking' AND column_name = 'google_maps_link'
  ) THEN
    ALTER TABLE gps_tracking ADD COLUMN google_maps_link TEXT;
    COMMENT ON COLUMN gps_tracking.google_maps_link IS 'Ссылка на Google Maps с текущими координатами';
  END IF;
END $$;

-- Создаем индексы если их ещё нет
CREATE INDEX IF NOT EXISTS idx_gps_tracking_car_id ON gps_tracking(car_id);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_status ON gps_tracking(status);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_is_moving ON gps_tracking(is_moving);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_last_sync ON gps_tracking(last_sync DESC);

-- Обновляем google_maps_link для существующих записей с координатами
UPDATE gps_tracking
SET google_maps_link = 'https://www.google.com/maps?q=' || current_lat || ',' || current_lng
WHERE current_lat IS NOT NULL 
  AND current_lng IS NOT NULL 
  AND (google_maps_link IS NULL OR google_maps_link = '');

-- Комментарии для документации
COMMENT ON TABLE gps_tracking IS 'GPS отслеживание автомобилей через Starline';
COMMENT ON COLUMN gps_tracking.car_id IS 'Связь с таблицей cars';
COMMENT ON COLUMN gps_tracking.starline_device_id IS 'IMEI устройства Starline';
COMMENT ON COLUMN gps_tracking.status IS 'Статус: offline, gps_offline, moving, parked_on, parked_off';
COMMENT ON COLUMN gps_tracking.is_moving IS 'Машина движется (определяется по изменению координат)';
COMMENT ON COLUMN gps_tracking.distance_moved IS 'Дистанция перемещения с момента последней проверки (метры)';
COMMENT ON COLUMN gps_tracking.ignition_on IS 'Зажигание включено (от Starline)';
COMMENT ON COLUMN gps_tracking.engine_running IS 'Двигатель работает (от Starline)';

