-- Migration: Fix ambiguous rentprog_id in sync_booking_car_id_from_car
-- Date: 2025-11-20
-- Author: Cursor Agent
-- Issue: column reference "rentprog_id" is ambiguous in sync_booking_car_id_from_car trigger

-- Fix: Use explicit table alias and rename variable to avoid ambiguity
CREATE OR REPLACE FUNCTION public.sync_booking_car_id_from_car()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  _rentprog_id TEXT;  -- Renamed variable to avoid ambiguity
BEGIN
  SELECT er.external_id
    INTO _rentprog_id
  FROM external_refs er
  WHERE er.entity_type = 'car'
    AND er.system = 'rentprog'
    AND er.entity_id = NEW.id
  ORDER BY er.updated_at DESC NULLS LAST
  LIMIT 1;

  IF _rentprog_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Use explicit table alias 'b' and renamed variable
  UPDATE bookings b
  SET car_id = NEW.id
  WHERE b.rentprog_car_id = _rentprog_id
    AND (b.car_id IS DISTINCT FROM NEW.id OR b.car_id IS NULL);

  RETURN NEW;
END;
$function$;

-- Verify the function was created successfully
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'sync_booking_car_id_from_car'
  ) THEN
    RAISE EXCEPTION 'Failed to create sync_booking_car_id_from_car function';
  END IF;
  
  RAISE NOTICE 'Successfully updated sync_booking_car_id_from_car function';
  RAISE NOTICE 'Fixed ambiguous rentprog_id reference by renaming variable to _rentprog_id';
END $$;

