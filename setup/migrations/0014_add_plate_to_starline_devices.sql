-- Миграция: Добавление поля plate в starline_devices
-- Дата: 2025-11-12
-- Назначение: Добавить номер машины (plate) для удобного поиска в одной таблице

-- Добавляем поле plate
ALTER TABLE starline_devices 
ADD COLUMN IF NOT EXISTS plate TEXT;

-- Создаем индекс для быстрого поиска по номеру
CREATE INDEX IF NOT EXISTS idx_starline_devices_plate ON starline_devices(plate) WHERE plate IS NOT NULL;

-- Заполняем plate из таблицы cars для всех сопоставленных устройств
UPDATE starline_devices sd
SET plate = c.plate
FROM cars c
WHERE sd.car_id = c.id
  AND sd.plate IS NULL;

-- Комментарий для документации
COMMENT ON COLUMN starline_devices.plate IS 'Номер машины (plate) из таблицы cars для удобного поиска';

