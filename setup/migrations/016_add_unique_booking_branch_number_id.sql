BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'bookings_branch_number_id_unique'
  ) THEN
    EXECUTE 'ALTER TABLE bookings
      ADD CONSTRAINT bookings_branch_number_id_unique UNIQUE (branch, number, id)';
  END IF;
END $$;

COMMIT;

