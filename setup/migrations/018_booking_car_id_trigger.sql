BEGIN;

CREATE OR REPLACE FUNCTION set_booking_car_id_from_rentprog()
RETURNS trigger AS $$
DECLARE
  car_uuid uuid;
BEGIN
  IF NEW.rentprog_car_id IS NULL OR NEW.rentprog_car_id = '' THEN
    RETURN NEW;
  END IF;

  IF NEW.car_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT er.entity_id::uuid
    INTO car_uuid
    FROM external_refs er
   WHERE er.system = 'rentprog'
     AND er.entity_type = 'car'
     AND er.external_id = NEW.rentprog_car_id
   ORDER BY er.updated_at DESC NULLS LAST
   LIMIT 1;

  IF car_uuid IS NOT NULL THEN
    NEW.car_id := car_uuid;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_booking_car_id ON bookings;
CREATE TRIGGER trg_set_booking_car_id
BEFORE INSERT OR UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION set_booking_car_id_from_rentprog();

WITH mapped AS (
  SELECT b.id AS booking_id, er.entity_id::uuid AS car_uuid
  FROM bookings b
  JOIN external_refs er
    ON er.system = 'rentprog'
   AND er.entity_type = 'car'
   AND er.external_id = b.rentprog_car_id
  WHERE b.rentprog_car_id IS NOT NULL
)
UPDATE bookings b
SET car_id = m.car_uuid
FROM mapped m
WHERE m.booking_id = b.id
  AND (b.car_id IS DISTINCT FROM m.car_uuid OR b.car_id IS NULL);

COMMIT;

