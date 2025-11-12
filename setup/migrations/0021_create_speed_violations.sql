-- Миграция: Создание таблицы нарушений скорости
-- Дата: 2025-11-12
-- Назначение: Логирование превышений скорости для предотвращения спама и анализа

CREATE TABLE IF NOT EXISTS speed_violations (
  id BIGSERIAL PRIMARY KEY,
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  starline_device_id BIGINT,
  speed NUMERIC(6, 2) NOT NULL, -- Скорость в км/ч
  speed_limit NUMERIC(6, 2) NOT NULL DEFAULT 125, -- Лимит скорости (км/ч)
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  google_maps_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT speed_violations_car_id_fkey FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_speed_violations_car_id ON speed_violations(car_id);
CREATE INDEX IF NOT EXISTS idx_speed_violations_created_at ON speed_violations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_speed_violations_car_created ON speed_violations(car_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_speed_violations_speed ON speed_violations(speed DESC);

-- Комментарии
COMMENT ON TABLE speed_violations IS 'Логирование превышений скорости (лимит: 125 км/ч)';
COMMENT ON COLUMN speed_violations.speed IS 'Скорость в км/ч в момент нарушения';
COMMENT ON COLUMN speed_violations.speed_limit IS 'Лимит скорости (по умолчанию 125 км/ч)';
COMMENT ON COLUMN speed_violations.google_maps_link IS 'Ссылка на Google Maps с местоположением нарушения';

