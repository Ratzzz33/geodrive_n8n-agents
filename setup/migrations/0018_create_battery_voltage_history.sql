-- Миграция: Создание таблицы истории вольтажа батареи
-- Дата: 2025-11-12
-- Назначение: Сохранение истории вольтажа для контроля нестандартного падения

CREATE TABLE IF NOT EXISTS battery_voltage_history (
  id BIGSERIAL PRIMARY KEY,
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  starline_device_id BIGINT,
  battery_voltage NUMERIC(5, 2) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Метаданные для анализа
  ignition_on BOOLEAN DEFAULT FALSE,
  engine_running BOOLEAN DEFAULT FALSE,
  status TEXT, -- 'offline', 'gps_offline', 'moving', 'parked_on', 'parked_off'
  
  -- Индексы для быстрого поиска
  CONSTRAINT battery_voltage_history_car_id_fkey FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_battery_voltage_history_car_id ON battery_voltage_history(car_id);
CREATE INDEX IF NOT EXISTS idx_battery_voltage_history_timestamp ON battery_voltage_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_battery_voltage_history_device_id ON battery_voltage_history(starline_device_id);
CREATE INDEX IF NOT EXISTS idx_battery_voltage_history_car_timestamp ON battery_voltage_history(car_id, timestamp DESC);

-- Комментарии к таблице
COMMENT ON TABLE battery_voltage_history IS 'История вольтажа батареи для контроля нестандартного падения';
COMMENT ON COLUMN battery_voltage_history.battery_voltage IS 'Напряжение АКБ в вольтах (V)';
COMMENT ON COLUMN battery_voltage_history.timestamp IS 'Время измерения вольтажа';
COMMENT ON COLUMN battery_voltage_history.ignition_on IS 'Зажигание включено в момент измерения';
COMMENT ON COLUMN battery_voltage_history.engine_running IS 'Двигатель работал в момент измерения';

