-- Миграция: Исправление конфликтного ключа в gps_tracking
-- Дата: 2025-11-12
-- Проблема: ON CONFLICT (car_id) обновлял данные в неправильной машине
-- Решение: Используем starline_device_id как уникальный ключ для обновления

-- 1. Удаляем дубликаты starline_device_id, оставляя только последнюю запись
DELETE FROM gps_tracking gt1
WHERE gt1.id NOT IN (
  SELECT DISTINCT ON (starline_device_id) id
  FROM gps_tracking
  WHERE starline_device_id IS NOT NULL
  ORDER BY starline_device_id, last_sync DESC NULLS LAST, id DESC
);

-- 2. Удаляем UNIQUE constraint на car_id (если есть)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'gps_tracking_car_id_key'
  ) THEN
    ALTER TABLE gps_tracking DROP CONSTRAINT gps_tracking_car_id_key;
    RAISE NOTICE 'Удален UNIQUE constraint на car_id';
  END IF;
END $$;

-- 3. Добавляем уникальный индекс на starline_device_id (если его еще нет)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'gps_tracking' 
    AND indexname = 'gps_tracking_starline_device_id_unique'
  ) THEN
    CREATE UNIQUE INDEX gps_tracking_starline_device_id_unique 
    ON gps_tracking(starline_device_id) 
    WHERE starline_device_id IS NOT NULL;
    RAISE NOTICE 'Создан уникальный индекс на starline_device_id';
  END IF;
END $$;

-- 4. Исправляем неправильные записи: обновляем car_id по starline_device_id из starline_devices
UPDATE gps_tracking gt
SET car_id = sd.car_id
FROM starline_devices sd
WHERE gt.starline_device_id = sd.device_id
  AND sd.matched = TRUE
  AND sd.active = TRUE
  AND gt.car_id != sd.car_id;

-- Комментарий
COMMENT ON INDEX gps_tracking_starline_device_id_unique IS 'Уникальный индекс для ON CONFLICT по starline_device_id';
