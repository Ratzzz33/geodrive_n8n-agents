-- 1) Добавляем недостающие колонки в cars
ALTER TABLE cars ADD COLUMN IF NOT EXISTS airbags TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS company_id INT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS description TEXT;

-- 2) Таблица цен по сезонам
CREATE TABLE IF NOT EXISTS car_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  rentprog_price_id TEXT,
  season_id INT,
  price_values INT[],
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  CONSTRAINT car_prices_unique UNIQUE (car_id, rentprog_price_id)
);

CREATE INDEX IF NOT EXISTS car_prices_car_idx ON car_prices (car_id);
CREATE INDEX IF NOT EXISTS car_prices_season_idx ON car_prices (season_id);

-- 3) Расширяем функцию синхронизации для недостающих полей
CREATE OR REPLACE FUNCTION cars_sync_from_data()
RETURNS TRIGGER AS $$
BEGIN
  -- ранее добавленные поля остаются; добавим недостающие
  NEW.airbags := NULLIF(NEW.data->>'airbags','null');
  NEW.company_id := CASE WHEN (NEW.data->>'company_id') ~ '^[0-9]+$' THEN (NEW.data->>'company_id')::int END;
  NEW.description := NULLIF(NEW.data->>'description','null');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- 4) Триггер для синхронизации цен из JSONB в отдельную таблицу
CREATE OR REPLACE FUNCTION cars_sync_prices_from_data()
RETURNS TRIGGER AS $$
DECLARE
  rec RECORD;
  vals INT[];
BEGIN
  -- Удаляем текущие цены и вставляем заново (простая стратегия)
  DELETE FROM car_prices WHERE car_id = NEW.id;

  IF NEW.data ? 'prices' THEN
    FOR rec IN SELECT * FROM jsonb_to_recordset(NEW.data->'prices') AS (
      id INT,
      car_id INT,
      values JSONB,
      season_id INT,
      created_at TEXT,
      updated_at TEXT
    ) LOOP
      SELECT COALESCE(array_agg((v)::INT), ARRAY[]::INT[])
      INTO vals
      FROM jsonb_array_elements_text(rec.values) AS v;

      INSERT INTO car_prices (car_id, rentprog_price_id, season_id, price_values, created_at, updated_at)
      VALUES (
        NEW.id,
        rec.id::TEXT,
        rec.season_id,
        vals,
        NULLIF(rec.created_at,'')::timestamptz,
        NULLIF(rec.updated_at,'')::timestamptz
      )
      ON CONFLICT (car_id, rentprog_price_id) DO UPDATE SET
        season_id = EXCLUDED.season_id,
        price_values = EXCLUDED.price_values,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at;
    END LOOP;
  END IF;

  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cars_sync_prices_from_data ON cars;
CREATE TRIGGER trg_cars_sync_prices_from_data
AFTER INSERT OR UPDATE OF data ON cars
FOR EACH ROW
EXECUTE FUNCTION cars_sync_prices_from_data();

-- 5) Бэкфилл
UPDATE cars SET data = data;


