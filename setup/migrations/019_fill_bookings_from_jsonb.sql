BEGIN;

-- Backfill existing rows where data jsonb still contains payload.
WITH src AS (
  SELECT id,
         NULLIF(branch, '') AS current_branch,
         branch,
         is_active,
         data,
         data->>'branch' AS branch_from_json,
         CASE
           WHEN data ? 'is_active' THEN (data->>'is_active')::boolean
           ELSE NULL
         END AS is_active_from_json,
         CASE
           WHEN data ? 'start_at' THEN (data->>'start_at')::timestamptz
           ELSE NULL
         END AS start_at_from_json,
         CASE
           WHEN data ? 'end_at' THEN (data->>'end_at')::timestamptz
           ELSE NULL
         END AS end_at_from_json
    FROM bookings
   WHERE data IS NOT NULL
     AND data <> '{}'::jsonb
     AND jsonb_typeof(data) = 'object'
)
UPDATE bookings b
SET branch = COALESCE(src.branch_from_json, NULLIF(b.branch, ''), 'unknown'),
    is_active = COALESCE(b.is_active, src.is_active_from_json),
    start_at = COALESCE(b.start_at, src.start_at_from_json),
    end_at = COALESCE(b.end_at, src.end_at_from_json),
    data = '{}'::jsonb
FROM src
WHERE b.id = src.id;

CREATE OR REPLACE FUNCTION fill_bookings_from_jsonb()
RETURNS trigger AS $$
DECLARE
  branch_from_json text;
  is_active_from_json boolean;
  start_at_from_json timestamptz;
  end_at_from_json timestamptz;
  processed boolean := false;
BEGIN
  IF NEW.data IS NOT NULL AND NEW.data <> '{}'::jsonb AND jsonb_typeof(NEW.data) = 'object' THEN
    branch_from_json := NEW.data->>'branch';
    IF (COALESCE(NEW.branch, '') = '' OR NEW.branch = 'unknown') AND branch_from_json IS NOT NULL AND branch_from_json <> '' THEN
      NEW.branch := branch_from_json;
      processed := true;
    END IF;

    IF NEW.is_active IS NULL AND NEW.data ? 'is_active' THEN
      BEGIN
        is_active_from_json := (NEW.data->>'is_active')::boolean;
        NEW.is_active := is_active_from_json;
        processed := true;
      EXCEPTION WHEN invalid_text_representation THEN
        -- ignore bad boolean casts
      END;
    END IF;

    IF NEW.start_at IS NULL AND NEW.data ? 'start_at' THEN
      BEGIN
        start_at_from_json := (NEW.data->>'start_at')::timestamptz;
        NEW.start_at := start_at_from_json;
        processed := true;
      EXCEPTION WHEN others THEN
      END;
    END IF;

    IF NEW.end_at IS NULL AND NEW.data ? 'end_at' THEN
      BEGIN
        end_at_from_json := (NEW.data->>'end_at')::timestamptz;
        NEW.end_at := end_at_from_json;
        processed := true;
      EXCEPTION WHEN others THEN
      END;
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

DROP TRIGGER IF EXISTS trg_fill_bookings_from_jsonb ON bookings;
CREATE TRIGGER trg_fill_bookings_from_jsonb
BEFORE INSERT OR UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION fill_bookings_from_jsonb();

COMMIT;

