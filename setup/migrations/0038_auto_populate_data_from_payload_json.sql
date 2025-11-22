-- Миграция: Автоматическое заполнение data из payload_json через trigger
-- Дата: 2025-11-20
-- Причина: n8n Postgres нода не может делать CAST из TEXT в JSONB автоматически

-- Функция для автозаполнения data из payload_json
CREATE OR REPLACE FUNCTION auto_populate_data_from_payload_json()
RETURNS TRIGGER AS $$
BEGIN
  -- Если payload_json заполнен, а data пустой - заполняем data
  IF NEW.payload_json IS NOT NULL AND NEW.payload_json <> '' THEN
    -- Преобразуем payload_json (TEXT) в JSONB и сохраняем в data
    NEW.data := NEW.payload_json::jsonb;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем trigger BEFORE INSERT OR UPDATE
DROP TRIGGER IF EXISTS auto_populate_data_trigger ON bookings;

CREATE TRIGGER auto_populate_data_trigger
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_data_from_payload_json();

-- Бэкфилл: заполняем data для существующих броней где payload_json есть, а data пустой
UPDATE bookings
SET data = payload_json::jsonb
WHERE payload_json IS NOT NULL 
AND payload_json <> ''
AND (data IS NULL OR data = '{}'::jsonb);

-- Проверка результата
DO $$
DECLARE
  total_count INTEGER;
  with_data_count INTEGER;
  backfilled_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM bookings;
  SELECT COUNT(*) INTO with_data_count FROM bookings WHERE data IS NOT NULL AND data != '{}'::jsonb;
  
  GET DIAGNOSTICS backfilled_count = ROW_COUNT;
  
  RAISE NOTICE 'Миграция завершена:';
  RAISE NOTICE '  Всего броней: %', total_count;
  RAISE NOTICE '  С заполненным data: %', with_data_count;
  RAISE NOTICE '  Бэкфилл выполнен для: % броней', backfilled_count;
END $$;

