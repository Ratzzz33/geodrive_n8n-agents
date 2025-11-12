-- Миграция: Создание таблицы истории скорости
-- Дата: 2025-11-12
-- Назначение: Сохранение истории скорости для анализа и контроля превышения

CREATE TABLE IF NOT EXISTS speed_history (
  id BIGSERIAL PRIMARY KEY,
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  starline_device_id BIGINT,
  speed NUMERIC(6, 2) NOT NULL, -- Скорость в км/ч
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Метаданные для анализа
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  ignition_on BOOLEAN DEFAULT FALSE,
  engine_running BOOLEAN DEFAULT FALSE,
  status TEXT, -- 'offline', 'gps_offline', 'moving', 'parked_on', 'parked_off'
  is_moving BOOLEAN DEFAULT FALSE,
  
  -- Индексы для быстрого поиска
  CONSTRAINT speed_history_car_id_fkey FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_speed_history_car_id ON speed_history(car_id);
CREATE INDEX IF NOT EXISTS idx_speed_history_timestamp ON speed_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_speed_history_device_id ON speed_history(starline_device_id);
CREATE INDEX IF NOT EXISTS idx_speed_history_car_timestamp ON speed_history(car_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_speed_history_speed ON speed_history(speed DESC) WHERE speed > 0;

-- Комментарии к таблице
COMMENT ON TABLE speed_history IS 'История скорости для анализа и контроля превышения';
COMMENT ON COLUMN speed_history.speed IS 'Скорость в км/ч';
COMMENT ON COLUMN speed_history.timestamp IS 'Время измерения скорости';
COMMENT ON COLUMN speed_history.ignition_on IS 'Зажигание включено в момент измерения';
COMMENT ON COLUMN speed_history.engine_running IS 'Двигатель работал в момент измерения';
COMMENT ON COLUMN speed_history.is_moving IS 'Машина в движении (определяется по координатам)';

