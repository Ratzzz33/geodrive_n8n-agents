-- Миграция: Добавление поля data в таблицу cars
-- Описание: Добавляем JSONB поле для хранения полного JSON объекта из RentProg API
-- Дата: 2025-11-03
-- Автор: Cursor Agent

-- Добавляем поле data (JSONB) для хранения полного JSON из RentProg
ALTER TABLE cars 
ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

-- Добавляем комментарий к полю
COMMENT ON COLUMN cars.data IS 'Полный JSON объект автомобиля из RentProg API (для хранения всех полей)';

-- Создаем GIN индекс для быстрого поиска по JSON полям
CREATE INDEX IF NOT EXISTS idx_cars_data_gin ON cars USING GIN (data);

-- Комментарий к индексу
COMMENT ON INDEX idx_cars_data_gin IS 'GIN индекс для быстрого поиска по JSONB полю data';

-- Проверка результата
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'cars' 
        AND column_name = 'data'
    ) THEN
        RAISE NOTICE '✓ Поле data успешно добавлено в таблицу cars';
    ELSE
        RAISE EXCEPTION '✗ Ошибка: Поле data не было добавлено';
    END IF;
END $$;

