BEGIN;

CREATE OR REPLACE FUNCTION fill_bookings_from_jsonb()
RETURNS trigger AS $$
DECLARE
  payload jsonb := NEW.data;
  processed boolean := false;
BEGIN
  IF payload IS NOT NULL AND payload <> '{}'::jsonb AND jsonb_typeof(payload) = 'object' THEN

    -- branch + is_active
    IF (COALESCE(NEW.branch, '') = '' OR NEW.branch = 'unknown') AND payload ? 'branch' THEN
      NEW.branch := COALESCE(NULLIF(payload->>'branch', ''), NEW.branch, 'unknown');
      processed := true;
    END IF;

    IF NEW.is_active IS NULL AND payload ? 'is_active' THEN
      BEGIN
        NEW.is_active := (payload->>'is_active')::boolean;
        processed := true;
      EXCEPTION WHEN invalid_text_representation THEN
        -- ignore malformed boolean
      END;
    END IF;

    -- ISO timestamps
    IF NEW.start_at IS NULL AND payload ? 'start_at' THEN
      BEGIN
        NEW.start_at := (payload->>'start_at')::timestamptz;
        processed := true;
      EXCEPTION WHEN others THEN END;
    END IF;

    IF NEW.end_at IS NULL AND payload ? 'end_at' THEN
      BEGIN
        NEW.end_at := (payload->>'end_at')::timestamptz;
        processed := true;
      EXCEPTION WHEN others THEN END;
    END IF;

    -- Raw date strings
    IF (NEW.start_date IS NULL OR NEW.start_date = '') AND payload ? 'start_date' THEN
      NEW.start_date := payload->>'start_date';
      processed := true;
    END IF;

    IF (NEW.end_date IS NULL OR NEW.end_date = '') AND payload ? 'end_date' THEN
      NEW.end_date := payload->>'end_date';
      processed := true;
    END IF;

    IF (NEW.start_date_formatted IS NULL OR NEW.start_date_formatted = '') AND payload ? 'start_date_formatted' THEN
      NEW.start_date_formatted := payload->>'start_date_formatted';
      processed := true;
    END IF;

    IF (NEW.end_date_formatted IS NULL OR NEW.end_date_formatted = '') AND payload ? 'end_date_formatted' THEN
      NEW.end_date_formatted := payload->>'end_date_formatted';
      processed := true;
    END IF;

    -- Monetary fields
    IF NEW.total IS NULL AND payload ? 'total' THEN
      BEGIN
        NEW.total := (payload->>'total')::numeric;
        processed := true;
      EXCEPTION WHEN invalid_text_representation THEN END;
    END IF;

    IF NEW.deposit IS NULL AND payload ? 'deposit' THEN
      BEGIN
        NEW.deposit := (payload->>'deposit')::numeric;
        processed := true;
      EXCEPTION WHEN invalid_text_representation THEN END;
    END IF;

    IF NEW.rental_cost IS NULL AND payload ? 'rental_cost' THEN
      BEGIN
        NEW.rental_cost := (payload->>'rental_cost')::numeric;
        processed := true;
      EXCEPTION WHEN invalid_text_representation THEN END;
    END IF;

    -- Misc numeric fields
    IF NEW.days IS NULL AND payload ? 'days' THEN
      BEGIN
        NEW.days := (payload->>'days')::numeric;
        processed := true;
      EXCEPTION WHEN invalid_text_representation THEN END;
    END IF;

    IF NEW.start_worker_id IS NULL AND payload ? 'start_worker_id' THEN
      BEGIN
        NEW.start_worker_id := (payload->>'start_worker_id')::integer;
        processed := true;
      EXCEPTION WHEN invalid_text_representation THEN END;
    END IF;

    IF NEW.end_worker_id IS NULL AND payload ? 'end_worker_id' THEN
      BEGIN
        NEW.end_worker_id := (payload->>'end_worker_id')::integer;
        processed := true;
      EXCEPTION WHEN invalid_text_representation THEN END;
    END IF;

    -- Booleans
    IF NEW.in_rent IS NULL AND payload ? 'in_rent' THEN
      BEGIN
        NEW.in_rent := (payload->>'in_rent')::boolean;
        processed := true;
      EXCEPTION WHEN invalid_text_representation THEN END;
    END IF;

    IF NEW.archive IS NULL AND payload ? 'archive' THEN
      BEGIN
        NEW.archive := (payload->>'archive')::boolean;
        processed := true;
      EXCEPTION WHEN invalid_text_representation THEN END;
    END IF;

    IF NEW.is_technical IS NULL AND payload ? 'is_technical' THEN
      BEGIN
        NEW.is_technical := (payload->>'is_technical')::boolean;
        processed := true;
      EXCEPTION WHEN invalid_text_representation THEN END;
    END IF;

    -- Text fields
    IF (NEW.client_name IS NULL OR NEW.client_name = '') AND payload ? 'client_name' THEN
      NEW.client_name := payload->>'client_name';
      processed := true;
    END IF;

    IF (NEW.client_category IS NULL OR NEW.client_category = '') AND payload ? 'client_category' THEN
      NEW.client_category := payload->>'client_category';
      processed := true;
    END IF;

    IF (NEW.car_name IS NULL OR NEW.car_name = '') AND payload ? 'car_name' THEN
      NEW.car_name := payload->>'car_name';
      processed := true;
    END IF;

    IF (NEW.car_code IS NULL OR NEW.car_code = '') AND payload ? 'car_code' THEN
      NEW.car_code := payload->>'car_code';
      processed := true;
    END IF;

    IF (NEW.location_start IS NULL OR NEW.location_start = '') AND payload ? 'location_start' THEN
      NEW.location_start := payload->>'location_start';
      processed := true;
    END IF;

    IF (NEW.location_end IS NULL OR NEW.location_end = '') AND payload ? 'location_end' THEN
      NEW.location_end := payload->>'location_end';
      processed := true;
    END IF;

    IF (NEW.state IS NULL OR NEW.state = '') AND payload ? 'state' THEN
      NEW.state := payload->>'state';
      processed := true;
    END IF;

    IF (NEW.responsible IS NULL OR NEW.responsible = '') AND payload ? 'responsible' THEN
      NEW.responsible := payload->>'responsible';
      processed := true;
    END IF;

    IF (NEW.description IS NULL OR NEW.description = '') AND payload ? 'description' THEN
      NEW.description := payload->>'description';
      processed := true;
    END IF;

    IF (NEW.source IS NULL OR NEW.source = '') AND payload ? 'source' THEN
      NEW.source := payload->>'source';
      processed := true;
    END IF;

    IF (NEW.technical_type IS NULL OR NEW.technical_type = '') AND payload ? 'technical_type' THEN
      NEW.technical_type := payload->>'technical_type';
      processed := true;
    END IF;

    IF (NEW.technical_purpose IS NULL OR NEW.technical_purpose = '') AND payload ? 'technical_purpose' THEN
      NEW.technical_purpose := payload->>'technical_purpose';
      processed := true;
    END IF;

    IF processed THEN
      NEW.data := '{}'::jsonb;
    END IF;
  END IF;

  IF COALESCE(NEW.branch, '') = '' THEN
    NEW.branch := 'unknown';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill existing rows by re-triggering the logic
UPDATE bookings
   SET data = data
 WHERE data IS NOT NULL
   AND data <> '{}'::jsonb
   AND jsonb_typeof(data) = 'object';

COMMIT;

