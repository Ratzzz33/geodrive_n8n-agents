-- ============================================================
-- Миграция: Добавление VIEW с русскими названиями статусов GPS
-- Дата: 2025-11-14
-- Описание: Создает справочную таблицу статусов и VIEW для удобных запросов
-- ============================================================

-- 1. Создать справочную таблицу статусов
-- ============================================================
CREATE TABLE IF NOT EXISTS gps_status_labels (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  emoji TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Комментарии к таблице
COMMENT ON TABLE gps_status_labels IS 'Справочник человекопонятных названий статусов GPS';
COMMENT ON COLUMN gps_status_labels.code IS 'Технический код статуса (как в gps_tracking.status)';
COMMENT ON COLUMN gps_status_labels.label IS 'Русское название для UI';
COMMENT ON COLUMN gps_status_labels.emoji IS 'Эмодзи для визуализации';
COMMENT ON COLUMN gps_status_labels.category IS 'Категория: active, passive, unavailable';
COMMENT ON COLUMN gps_status_labels.description IS 'Подробное описание статуса';

-- 2. Заполнить справочник
-- ============================================================
INSERT INTO gps_status_labels (code, label, emoji, category, description) VALUES
  ('offline', 'Нет связи', '🔴', 'unavailable', 'Устройство не на связи с сервером'),
  ('gps_offline', 'Слабый GPS', '🟡', 'unavailable', 'Устройство онлайн, но GPS сигнал отсутствует или слабый'),
  ('moving', 'Едет', '🟢', 'active', 'Машина в движении (скорость > 5 км/ч или двигатель работает)'),
  ('parked_on', 'Стоит (заведена)', '🟠', 'active', 'Машина стоит с включенным зажиганием (прогрев, светофор)'),
  ('parked_off', 'Припаркована', '⚪', 'passive', 'Машина припаркована с выключенным зажиганием')
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  emoji = EXCLUDED.emoji,
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- 3. Создать VIEW для удобных запросов
-- ============================================================
CREATE OR REPLACE VIEW gps_tracking_with_labels AS
SELECT 
  gt.id,
  gt.car_id,
  gt.starline_device_id,
  gt.starline_alias,
  gt.status,
  gt.speed,
  gt.distance_moved,
  gt.current_lat,
  gt.current_lng,
  gt.current_sat_qty,
  gt.current_timestamp,
  gt.ignition_on,
  gt.engine_running,
  gt.battery_voltage,
  gt.gps_level,
  gt.gsm_level,
  gt.is_moving,
  gt.google_maps_link,
  gt.updated_at,
  -- Добавляем человекопонятные поля
  sl.label AS status_label,
  sl.emoji AS status_emoji,
  sl.category AS status_category,
  sl.description AS status_description,
  (sl.emoji || ' ' || sl.label) AS status_display
FROM gps_tracking gt
LEFT JOIN gps_status_labels sl ON gt.status = sl.code;

-- Комментарий к VIEW
COMMENT ON VIEW gps_tracking_with_labels IS 'GPS трекинг с человекопонятными названиями статусов (для UI)';

-- 4. Создать индексы для производительности
-- ============================================================
-- Индекс для JOIN по статусу (если еще нет)
CREATE INDEX IF NOT EXISTS idx_gps_tracking_status ON gps_tracking(status);

-- Индекс для быстрого поиска по car_id + updated_at (последние данные)
CREATE INDEX IF NOT EXISTS idx_gps_tracking_car_updated 
  ON gps_tracking(car_id, updated_at DESC);

-- 5. Создать функцию для добавления новых статусов
-- ============================================================
CREATE OR REPLACE FUNCTION add_gps_status_label(
  p_code TEXT,
  p_label TEXT,
  p_emoji TEXT,
  p_category TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO gps_status_labels (code, label, emoji, category, description)
  VALUES (p_code, p_label, p_emoji, p_category, p_description)
  ON CONFLICT (code) DO UPDATE SET
    label = EXCLUDED.label,
    emoji = EXCLUDED.emoji,
    category = EXCLUDED.category,
    description = EXCLUDED.description;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION add_gps_status_label IS 'Добавить или обновить статус в справочнике';

-- ============================================================
-- Готово! Теперь можно использовать:
-- SELECT * FROM gps_tracking_with_labels WHERE car_id = '...';
-- ============================================================

