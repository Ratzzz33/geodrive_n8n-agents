-- Добавление базовых FK для телеметрии Starline и snapshot таблиц
BEGIN;

ALTER TABLE battery_voltage_history
  ADD CONSTRAINT battery_voltage_history_starline_device_id_fkey
  FOREIGN KEY (starline_device_id) REFERENCES starline_devices(device_id)
  DEFERRABLE INITIALLY DEFERRED NOT VALID;
ALTER TABLE battery_voltage_history
  VALIDATE CONSTRAINT battery_voltage_history_starline_device_id_fkey;

ALTER TABLE battery_voltage_alerts
  ADD CONSTRAINT battery_voltage_alerts_starline_device_id_fkey
  FOREIGN KEY (starline_device_id) REFERENCES starline_devices(device_id)
  DEFERRABLE INITIALLY DEFERRED NOT VALID;
ALTER TABLE battery_voltage_alerts
  VALIDATE CONSTRAINT battery_voltage_alerts_starline_device_id_fkey;

ALTER TABLE speed_history
  ADD CONSTRAINT speed_history_starline_device_id_fkey
  FOREIGN KEY (starline_device_id) REFERENCES starline_devices(device_id)
  DEFERRABLE INITIALLY DEFERRED NOT VALID;
ALTER TABLE speed_history
  VALIDATE CONSTRAINT speed_history_starline_device_id_fkey;

ALTER TABLE speed_violations
  ADD CONSTRAINT speed_violations_starline_device_id_fkey
  FOREIGN KEY (starline_device_id) REFERENCES starline_devices(device_id)
  DEFERRABLE INITIALLY DEFERRED NOT VALID;
ALTER TABLE speed_violations
  VALIDATE CONSTRAINT speed_violations_starline_device_id_fkey;

ALTER TABLE rentprog_car_states_snapshot
  ADD CONSTRAINT rentprog_car_states_snapshot_branch_id_fkey
  FOREIGN KEY (branch_id) REFERENCES branches(id)
  DEFERRABLE INITIALLY DEFERRED NOT VALID;
ALTER TABLE rentprog_car_states_snapshot
  VALIDATE CONSTRAINT rentprog_car_states_snapshot_branch_id_fkey;

COMMIT;

