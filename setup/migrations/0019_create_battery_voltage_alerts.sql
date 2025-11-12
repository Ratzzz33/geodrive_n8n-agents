-- Миграция: Создание таблицы уведомлений о нестандартном падении вольтажа
-- Дата: 2025-11-12
-- Назначение: Логирование уведомлений для предотвращения спама

CREATE TABLE IF NOT EXISTS battery_voltage_alerts (
  id BIGSERIAL PRIMARY KEY,
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  starline_device_id BIGINT,
  battery_voltage NUMERIC(5, 2) NOT NULL,
  avg_voltage NUMERIC(5, 2) NOT NULL,
  deviation NUMERIC(5, 2) NOT NULL, -- Отклонение от среднего
  deviation_percent NUMERIC(5, 2) NOT NULL, -- Отклонение в процентах
  is_critical BOOLEAN DEFAULT FALSE, -- Критическое отклонение (>2 стандартных отклонений)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT battery_voltage_alerts_car_id_fkey FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_battery_voltage_alerts_car_id ON battery_voltage_alerts(car_id);
CREATE INDEX IF NOT EXISTS idx_battery_voltage_alerts_created_at ON battery_voltage_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_battery_voltage_alerts_car_created ON battery_voltage_alerts(car_id, created_at DESC);

-- Комментарии
COMMENT ON TABLE battery_voltage_alerts IS 'Логирование уведомлений о нестандартном падении вольтажа';
COMMENT ON COLUMN battery_voltage_alerts.deviation IS 'Отклонение от среднего вольтажа (V)';
COMMENT ON COLUMN battery_voltage_alerts.deviation_percent IS 'Отклонение от среднего в процентах (%)';
COMMENT ON COLUMN battery_voltage_alerts.is_critical IS 'Критическое отклонение (ниже среднего на >2 стандартных отклонений)';

