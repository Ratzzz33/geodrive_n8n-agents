-- Исправление constraint для car_prices
-- Должен быть UNIQUE (car_id, season_id), а не UNIQUE (car_id, rentprog_price_id)

BEGIN;

-- Удалить старый constraint
ALTER TABLE car_prices DROP CONSTRAINT IF EXISTS car_prices_unique;

-- Создать правильный constraint
ALTER TABLE car_prices 
  ADD CONSTRAINT car_prices_car_season_unique 
  UNIQUE (car_id, season_id);

COMMIT;

