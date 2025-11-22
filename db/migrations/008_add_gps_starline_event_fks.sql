BEGIN;

ALTER TABLE starline_events
  ADD CONSTRAINT starline_events_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES events(id)
  DEFERRABLE INITIALLY DEFERRED NOT VALID;
ALTER TABLE starline_events
  VALIDATE CONSTRAINT starline_events_event_id_fkey;

ALTER TABLE gps_tracking
  ADD CONSTRAINT gps_tracking_starline_device_id_fkey
  FOREIGN KEY (starline_device_id) REFERENCES starline_devices(device_id)
  DEFERRABLE INITIALLY DEFERRED NOT VALID;
ALTER TABLE gps_tracking
  VALIDATE CONSTRAINT gps_tracking_starline_device_id_fkey;

COMMIT;

