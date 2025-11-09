-- Миграция: Создание таблиц для Starline GPS мониторинга
-- Дата: 2025-11-09

-- Таблица для хранения всех устройств Starline
CREATE TABLE IF NOT EXISTS starline_devices (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT UNIQUE NOT NULL, -- IMEI устройства из Starline
  alias TEXT NOT NULL, -- Название устройства в Starline (например, "BMW 3 587")
  
  -- Связь с таблицей cars
  car_id UUID REFERENCES cars(id) ON DELETE SET NULL,
  matched BOOLEAN DEFAULT FALSE, -- сопоставлено ли с cars
  match_confidence NUMERIC(3, 2), -- уверенность сопоставления (0.00 - 1.00)
  match_method TEXT, -- метод сопоставления: 'auto' | 'manual' | null
  match_notes TEXT, -- заметки о сопоставлении
  
  -- Извлеченные данные для сопоставления
  extracted_model TEXT, -- извлеченная модель из alias ("BMW 3")
  extracted_digits TEXT, -- извлеченные 3 цифры ("587")
  
  -- Дополнительные данные от Starline API
  imei TEXT,
  phone TEXT,
  sn TEXT, -- серийный номер
  device_type INT,
  fw_version TEXT, -- версия прошивки
  
  -- История изменений названия
  previous_aliases TEXT[], -- массив предыдущих названий
  alias_changed_at TIMESTAMPTZ, -- когда последний раз менялся alias
  
  -- Метаданные
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE, -- активно ли устройство
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_starline_devices_device_id ON starline_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_starline_devices_car_id ON starline_devices(car_id);
CREATE INDEX IF NOT EXISTS idx_starline_devices_extracted_model ON starline_devices(extracted_model);
CREATE INDEX IF NOT EXISTS idx_starline_devices_extracted_digits ON starline_devices(extracted_digits);
CREATE INDEX IF NOT EXISTS idx_starline_devices_matched ON starline_devices(matched);
CREATE INDEX IF NOT EXISTS idx_starline_devices_active ON starline_devices(active);

-- Таблица для истории сопоставлений (для аналитики и улучшения алгоритма)
CREATE TABLE IF NOT EXISTS starline_match_history (
  id BIGSERIAL PRIMARY KEY,
  starline_device_id BIGINT REFERENCES starline_devices(id) ON DELETE CASCADE,
  car_id UUID REFERENCES cars(id) ON DELETE CASCADE,
  matched BOOLEAN NOT NULL,
  confidence NUMERIC(3, 2),
  method TEXT NOT NULL, -- 'auto_match' | 'manual_match' | 'unmatch' | 'alias_change_unmatch'
  starline_alias TEXT,
  starline_digits TEXT,
  starline_model TEXT,
  car_license_plate TEXT,
  car_brand TEXT,
  car_model TEXT,
  reason TEXT,
  created_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_starline_match_history_device ON starline_match_history(starline_device_id);
CREATE INDEX IF NOT EXISTS idx_starline_match_history_car ON starline_match_history(car_id);
CREATE INDEX IF NOT EXISTS idx_starline_match_history_created ON starline_match_history(created_at DESC);

-- Функция для автоматического извлечения модели и цифр из alias + история изменений
CREATE OR REPLACE FUNCTION extract_starline_alias_data()
RETURNS TRIGGER AS $$
DECLARE
  digits_match TEXT;
  model_clean TEXT;
BEGIN
  -- При UPDATE: сохраняем старый alias в историю если изменился
  IF TG_OP = 'UPDATE' AND OLD.alias IS DISTINCT FROM NEW.alias THEN
    -- Добавляем старый alias в массив previous_aliases
    IF OLD.previous_aliases IS NULL THEN
      NEW.previous_aliases := ARRAY[OLD.alias];
    ELSE
      -- Избегаем дубликатов
      IF NOT (OLD.alias = ANY(OLD.previous_aliases)) THEN
        NEW.previous_aliases := array_append(OLD.previous_aliases, OLD.alias);
      ELSE
        NEW.previous_aliases := OLD.previous_aliases;
      END IF;
    END IF;
    
    -- Обновляем время изменения
    NEW.alias_changed_at := NOW();
    
    -- Сбрасываем сопоставление если цифры изменились
    IF NEW.matched = TRUE THEN
      DECLARE
        old_digits TEXT := (regexp_match(OLD.alias, '\d{3}'))[1];
        new_digits TEXT := (regexp_match(NEW.alias, '\d{3}'))[1];
      BEGIN
        -- Если цифры изменились - сбрасываем сопоставление
        IF old_digits IS DISTINCT FROM new_digits THEN
          NEW.matched := FALSE;
          NEW.car_id := NULL;
          NEW.match_confidence := NULL;
          NEW.match_notes := 'Автоматически сброшено: изменились цифры в alias';
          
          -- Логируем в историю сопоставлений
          INSERT INTO starline_match_history (
            starline_device_id, 
            car_id, 
            matched, 
            method, 
            reason,
            starline_alias,
            created_by
          ) VALUES (
            NEW.id,
            OLD.car_id,
            FALSE,
            'alias_change_unmatch',
            'Автоматически сброшено: изменились цифры в alias',
            NEW.alias,
            'system_trigger'
          );
        END IF;
      END;
    END IF;
  END IF;
  
  -- Извлекаем последние 3 цифры
  digits_match := (regexp_match(NEW.alias, '\d{3}'))[1];
  NEW.extracted_digits := digits_match;
  
  -- Извлекаем модель (всё до первых 3 цифр)
  IF digits_match IS NOT NULL THEN
    model_clean := regexp_replace(NEW.alias, '\s+' || digits_match || '.*$', '', 'g');
    NEW.extracted_model := TRIM(model_clean);
  ELSE
    NEW.extracted_model := NEW.alias;
  END IF;
  
  -- Обновляем updated_at
  NEW.updated_at := NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматической обработки alias
DROP TRIGGER IF EXISTS starline_devices_extract_alias_trigger ON starline_devices;
CREATE TRIGGER starline_devices_extract_alias_trigger
  BEFORE INSERT OR UPDATE OF alias ON starline_devices
  FOR EACH ROW
  EXECUTE FUNCTION extract_starline_alias_data();

-- View для удобного просмотра сопоставлений
CREATE OR REPLACE VIEW starline_devices_with_cars AS
SELECT 
  sd.id as starline_device_id,
  sd.device_id,
  sd.alias as starline_alias,
  sd.extracted_model,
  sd.extracted_digits,
  sd.previous_aliases,
  sd.alias_changed_at,
  sd.matched,
  sd.match_confidence,
  sd.match_method,
  sd.match_notes,
  sd.car_id,
  c.brand as car_brand,
  c.model as car_model,
  c.license_plate as car_license_plate,
  c.branch as car_branch,
  sd.imei,
  sd.phone,
  sd.sn,
  sd.device_type,
  sd.fw_version,
  sd.active,
  sd.last_seen,
  sd.first_seen,
  sd.created_at,
  sd.updated_at
FROM starline_devices sd
LEFT JOIN cars c ON c.id = sd.car_id
ORDER BY sd.matched DESC, sd.last_seen DESC;

-- Комментарии для документации
COMMENT ON TABLE starline_devices IS 'Все устройства из Starline с возможностью сопоставления с cars';
COMMENT ON COLUMN starline_devices.device_id IS 'IMEI устройства из Starline (уникальный)';
COMMENT ON COLUMN starline_devices.car_id IS 'Связь с таблицей cars (nullable если не сопоставлено)';
COMMENT ON COLUMN starline_devices.matched IS 'Сопоставлено ли устройство с машиной';
COMMENT ON COLUMN starline_devices.match_confidence IS 'Уверенность сопоставления от 0.00 (низкая) до 1.00 (высокая)';
COMMENT ON COLUMN starline_devices.extracted_digits IS 'Автоматически извлеченные 3 цифры из alias';
COMMENT ON COLUMN starline_devices.extracted_model IS 'Автоматически извлеченная модель из alias';
COMMENT ON COLUMN starline_devices.previous_aliases IS 'История предыдущих названий устройства (массив)';
COMMENT ON COLUMN starline_devices.alias_changed_at IS 'Время последнего изменения alias';

COMMENT ON TABLE starline_match_history IS 'История попыток сопоставления для аналитики и улучшения алгоритма';

COMMENT ON VIEW starline_devices_with_cars IS 'View для удобного просмотра сопоставленных устройств';
