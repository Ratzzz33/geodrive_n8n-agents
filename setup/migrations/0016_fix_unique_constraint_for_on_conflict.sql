-- Миграция 0016: Создание полноценного UNIQUE CONSTRAINT для ON CONFLICT
-- Проблема: Partial index не работает с ON CONFLICT

-- Шаг 1: Удалить partial UNIQUE INDEX
DROP INDEX IF EXISTS gps_tracking_starline_device_id_unique;

-- Шаг 2: Создать полноценный UNIQUE CONSTRAINT
-- Обрабатываем NULL значения: разрешаем несколько NULL, но требуем уникальность для NOT NULL
ALTER TABLE gps_tracking 
ADD CONSTRAINT gps_tracking_starline_device_id_key 
UNIQUE NULLS NOT DISTINCT (starline_device_id);

-- Примечание: NULLS NOT DISTINCT означает, что множественные NULL будут нарушать UNIQUE
-- Если нужны множественные NULL, используем partial unique index,
-- но тогда ON CONFLICT работать не будет.
-- 
-- Для нашего случая: starline_device_id всегда NOT NULL при вставке из Starline,
-- поэтому NULLS NOT DISTINCT подходит.

