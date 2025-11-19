-- Миграция: Создание таблицы истории GPS координат
-- Дата: 2025-11-18
-- Назначение: Сохранение полной истории координат для всех автомобилей при каждом обновлении GPS

CREATE TABLE IF NOT EXISTS gps_tracking_history (
  id BIGSERIAL PRIMARY KEY,
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  starline_device_id BIGINT,
  
  -- Координаты
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  satellites INT,
  
  -- Статус и движение
  status TEXT, -- 'offline', 'gps_offline', 'moving', 'parked_on', 'parked_off'
  is_moving BOOLEAN DEFAULT FALSE,
  speed NUMERIC(6, 2), -- км/ч
  distance_moved NUMERIC(10, 2), -- метры
  
  -- GPS и связь
  gps_level INT,
  gsm_level INT,
  
  -- Состояние автомобиля
  ignition_on BOOLEAN DEFAULT FALSE,
  engine_running BOOLEAN DEFAULT FALSE,
  parking_brake BOOLEAN DEFAULT FALSE,
  battery_voltage NUMERIC(5, 2),
  
  -- Метаданные
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Время GPS данных
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW() -- Время создания записи в БД
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_gps_tracking_history_car_id ON gps_tracking_history(car_id);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_history_timestamp ON gps_tracking_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_history_device_id ON gps_tracking_history(starline_device_id);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_history_car_timestamp ON gps_tracking_history(car_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_history_status ON gps_tracking_history(status) WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gps_tracking_history_moving ON gps_tracking_history(car_id, timestamp DESC) WHERE is_moving = TRUE;

-- Комментарии к таблице
COMMENT ON TABLE gps_tracking_history IS 'Полная история GPS координат для всех автомобилей';
COMMENT ON COLUMN gps_tracking_history.timestamp IS 'Время GPS данных (из Starline)';
COMMENT ON COLUMN gps_tracking_history.created_at IS 'Время создания записи в БД';
COMMENT ON COLUMN gps_tracking_history.speed IS 'Скорость в км/ч';
COMMENT ON COLUMN gps_tracking_history.distance_moved IS 'Расстояние, пройденное с предыдущего обновления (в метрах)';

