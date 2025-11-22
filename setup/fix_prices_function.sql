-- Исправление функции cars_sync_prices_from_data для работы с JSONB массивом цен
CREATE OR REPLACE FUNCTION public.cars_sync_prices_from_data()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  rec RECORD;
BEGIN
  -- Обрабатываем цены если они есть в data->'prices'
  -- RentProg может присылать prices как массив объектов
  IF NEW.data ? 'prices' AND jsonb_typeof(NEW.data->'prices') = 'array' THEN
    
    FOR rec IN SELECT * FROM jsonb_to_recordset(NEW.data->'prices') AS (
      id INT,
      "values" JSONB,
      season_id INT,
      created_at TEXT,
      updated_at TEXT
    ) LOOP
      
      -- Вставляем или обновляем цены
      -- rec.values уже является JSONB массивом (напр. [50, 45, 40...])
      INSERT INTO car_prices (
        car_id, 
        rentprog_price_id, 
        season_id, 
        price_values, 
        created_at, 
        updated_at
      )
      VALUES (
        NEW.id,
        rec.id::TEXT,
        rec.season_id,
        rec."values", -- Прямая вставка JSONB
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
$function$;

