-- Recreate Primary Key on rentprog_car_states_snapshot
ALTER TABLE rentprog_car_states_snapshot DROP CONSTRAINT IF EXISTS rentprog_car_states_snapshot_pkey;
DROP INDEX IF EXISTS rentprog_car_states_snapshot_pkey;

ALTER TABLE rentprog_car_states_snapshot ADD CONSTRAINT rentprog_car_states_snapshot_pkey PRIMARY KEY (rentprog_id);

