-- Удаление колонки price_values из таблицы cars
-- Цены хранятся в отдельной таблице car_prices, а не в cars
-- Дата: 2025-11-17

-- Проверяем наличие колонки и удаляем её
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'cars' 
      AND column_name = 'price_values'
  ) THEN
    ALTER TABLE cars DROP COLUMN price_values;
    RAISE NOTICE 'Колонка price_values удалена из таблицы cars';
  ELSE
    RAISE NOTICE 'Колонка price_values не найдена в таблице cars';
  END IF;
END $$;

