-- Миграция: Создание таблиц для работы с Starline API
-- Дата: 2025-01-XX
-- Описание: Таблицы для хранения событий, маршрутов и токенов Starline API

-- 1. Таблица для хранения токенов доступа
CREATE TABLE IF NOT EXISTS starline_api_tokens (
  id BIGSERIAL PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_starline_api_tokens_active ON starline_api_tokens(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_starline_api_tokens_expires ON starline_api_tokens(expires_at);

COMMENT ON TABLE starline_api_tokens IS 'Токены доступа к Starline API';
COMMENT ON COLUMN starline_api_tokens.access_token IS 'Токен доступа (действителен 1 час)';
COMMENT ON COLUMN starline_api_tokens.refresh_token IS 'Токен для обновления access_token';
COMMENT ON COLUMN starline_api_tokens.expires_at IS 'Время истечения токена';
COMMENT ON COLUMN starline_api_tokens.is_active IS 'Активен ли токен (только один активный)';

-- 2. Таблица для хранения истории событий
CREATE TABLE IF NOT EXISTS starline_events (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT NOT NULL REFERENCES starline_devices(device_id) ON DELETE CASCADE,
  event_id BIGINT UNIQUE NOT NULL, -- ID события из Starline API
  event_type TEXT NOT NULL, -- alarm_on, ignition_on, etc.
  timestamp TIMESTAMPTZ NOT NULL,
  data JSONB, -- Дополнительные данные события
  processed BOOLEAN DEFAULT FALSE, -- Обработано ли событие
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_starline_events_device_id ON starline_events(device_id);
CREATE INDEX IF NOT EXISTS idx_starline_events_timestamp ON starline_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_starline_events_type ON starline_events(event_type);
CREATE INDEX IF NOT EXISTS idx_starline_events_processed ON starline_events(processed) WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_starline_events_device_timestamp ON starline_events(device_id, timestamp DESC);

COMMENT ON TABLE starline_events IS 'История событий от Starline API';
COMMENT ON COLUMN starline_events.device_id IS 'ID устройства (IMEI)';
COMMENT ON COLUMN starline_events.event_id IS 'Уникальный ID события из Starline API';
COMMENT ON COLUMN starline_events.event_type IS 'Тип события: alarm_on, ignition_on, engine_start, etc.';
COMMENT ON COLUMN starline_events.timestamp IS 'Время события';
COMMENT ON COLUMN starline_events.data IS 'Дополнительные данные события (JSON)';
COMMENT ON COLUMN starline_events.processed IS 'Обработано ли событие (для фильтрации новых)';

-- 3. Таблица для хранения истории маршрутов
CREATE TABLE IF NOT EXISTS starline_routes (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT NOT NULL REFERENCES starline_devices(device_id) ON DELETE CASCADE,
  lat NUMERIC(10, 7) NOT NULL,
  lng NUMERIC(10, 7) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  speed NUMERIC(6, 2), -- км/ч
  course NUMERIC(5, 2), -- градусы (0-360)
  sat_qty INT, -- Количество спутников
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_starline_routes_device_id ON starline_routes(device_id);
CREATE INDEX IF NOT EXISTS idx_starline_routes_timestamp ON starline_routes(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_starline_routes_device_timestamp ON starline_routes(device_id, timestamp DESC);
-- Индекс для геоданных (требует расширение postgis, опционально)
-- CREATE INDEX IF NOT EXISTS idx_starline_routes_location ON starline_routes USING GIST (ll_to_earth(lat, lng));

COMMENT ON TABLE starline_routes IS 'История маршрутов от Starline API';
COMMENT ON COLUMN starline_routes.device_id IS 'ID устройства (IMEI)';
COMMENT ON COLUMN starline_routes.lat IS 'Широта';
COMMENT ON COLUMN starline_routes.lng IS 'Долгота';
COMMENT ON COLUMN starline_routes.timestamp IS 'Время точки маршрута';
COMMENT ON COLUMN starline_routes.speed IS 'Скорость в км/ч';
COMMENT ON COLUMN starline_routes.course IS 'Курс движения в градусах (0-360)';
COMMENT ON COLUMN starline_routes.sat_qty IS 'Количество спутников GPS';

-- 4. Добавление новых полей в gps_tracking
DO $$
BEGIN
  -- Добавляем поле course (курс движения)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gps_tracking' AND column_name = 'course'
  ) THEN
    ALTER TABLE gps_tracking ADD COLUMN course NUMERIC(5, 2);
    COMMENT ON COLUMN gps_tracking.course IS 'Курс движения в градусах (0-360)';
  END IF;

  -- Добавляем поле alarm_state (состояние охраны)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gps_tracking' AND column_name = 'alarm_state'
  ) THEN
    ALTER TABLE gps_tracking ADD COLUMN alarm_state TEXT;
    COMMENT ON COLUMN gps_tracking.alarm_state IS 'Состояние охраны: on, off, partial';
  END IF;

  -- Добавляем поле geofence_status (статус геозоны)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gps_tracking' AND column_name = 'geofence_status'
  ) THEN
    ALTER TABLE gps_tracking ADD COLUMN geofence_status TEXT;
    COMMENT ON COLUMN gps_tracking.geofence_status IS 'Статус геозоны';
  END IF;
END $$;

-- 5. Добавление полей в starline_devices
DO $$
BEGIN
  -- Добавляем поле last_api_sync (последняя синхронизация через API)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'starline_devices' AND column_name = 'last_api_sync'
  ) THEN
    ALTER TABLE starline_devices ADD COLUMN last_api_sync TIMESTAMPTZ;
    COMMENT ON COLUMN starline_devices.last_api_sync IS 'Последняя синхронизация через Starline API';
  END IF;

  -- Добавляем поле api_token_expires_at (время истечения токена)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'starline_devices' AND column_name = 'api_token_expires_at'
  ) THEN
    ALTER TABLE starline_devices ADD COLUMN api_token_expires_at TIMESTAMPTZ;
    COMMENT ON COLUMN starline_devices.api_token_expires_at IS 'Время истечения токена API (для информации)';
  END IF;
END $$;

-- 6. Функция для автоматической очистки старых маршрутов (опционально)
CREATE OR REPLACE FUNCTION cleanup_old_starline_routes()
RETURNS void AS $$
BEGIN
  -- Удаляем маршруты старше 90 дней
  DELETE FROM starline_routes
  WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_starline_routes() IS 'Очистка старых маршрутов (старше 90 дней)';

-- 7. Функция для автоматической очистки старых событий (опционально)
CREATE OR REPLACE FUNCTION cleanup_old_starline_events()
RETURNS void AS $$
BEGIN
  -- Удаляем обработанные события старше 180 дней
  DELETE FROM starline_events
  WHERE processed = TRUE
    AND timestamp < NOW() - INTERVAL '180 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_starline_events() IS 'Очистка старых обработанных событий (старше 180 дней)';

