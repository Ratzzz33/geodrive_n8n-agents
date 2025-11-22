BEGIN;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS rentprog_car_id TEXT;

CREATE INDEX IF NOT EXISTS idx_bookings_rentprog_car_id
  ON bookings (rentprog_car_id);

UPDATE bookings
SET rentprog_car_id = COALESCE(rentprog_car_id, data->>'car_id')
WHERE rentprog_car_id IS NULL
  AND data ? 'car_id';

CREATE OR REPLACE FUNCTION sync_booking_car_id_from_car()
RETURNS trigger AS $$
DECLARE
  rentprog_id TEXT;
BEGIN
  SELECT external_id
    INTO rentprog_id
  FROM external_refs
  WHERE entity_type = 'car'
    AND system = 'rentprog'
    AND entity_id = NEW.id
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF rentprog_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE bookings
  SET car_id = NEW.id
  WHERE rentprog_car_id = rentprog_id
    AND (car_id IS DISTINCT FROM NEW.id OR car_id IS NULL);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_booking_car_on_cars ON cars;
CREATE TRIGGER trg_sync_booking_car_on_cars
AFTER INSERT OR UPDATE ON cars
FOR EACH ROW
EXECUTE FUNCTION sync_booking_car_id_from_car();

CREATE OR REPLACE FUNCTION sync_booking_car_id_from_external_ref()
RETURNS trigger AS $$
BEGIN
  IF NEW.system = 'rentprog' AND NEW.entity_type = 'car' THEN
    UPDATE bookings
    SET car_id = NEW.entity_id::uuid
    WHERE rentprog_car_id = NEW.external_id
      AND (car_id IS DISTINCT FROM NEW.entity_id::uuid OR car_id IS NULL);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_booking_car_on_external_refs ON external_refs;
CREATE TRIGGER trg_sync_booking_car_on_external_refs
AFTER INSERT OR UPDATE ON external_refs
FOR EACH ROW
EXECUTE FUNCTION sync_booking_car_id_from_external_ref();

WITH mapped AS (
  SELECT b.id AS booking_id, er.entity_id::uuid AS car_uuid
  FROM bookings b
  JOIN external_refs er
    ON er.system = 'rentprog'
   AND er.entity_type = 'car'
   AND er.external_id = b.rentprog_car_id
)
UPDATE bookings b
SET car_id = m.car_uuid
FROM mapped m
WHERE m.booking_id = b.id
  AND (b.car_id IS DISTINCT FROM m.car_uuid OR b.car_id IS NULL);

COMMIT;

