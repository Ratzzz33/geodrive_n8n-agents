-- Миграция 0017: Добавление avatar_url в starline_devices
-- Цель: Упростить получение аватарок авто одним запросом для других ботов

-- Шаг 1: Добавить колонку avatar_url
ALTER TABLE starline_devices 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Шаг 2: Заполнить существующие записи из таблицы cars
UPDATE starline_devices sd
SET avatar_url = c.avatar_url
FROM cars c
WHERE sd.car_id = c.id
  AND sd.matched = TRUE
  AND c.avatar_url IS NOT NULL;

-- Шаг 3: Создать индекс для быстрого поиска (опционально)
CREATE INDEX IF NOT EXISTS idx_starline_devices_avatar_url 
ON starline_devices(avatar_url) 
WHERE avatar_url IS NOT NULL;

-- Примечание: После этой миграции при обновлении starline_devices 
-- нужно будет также обновлять avatar_url из cars

