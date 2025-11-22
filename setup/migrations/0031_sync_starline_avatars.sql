-- 0031: Синхронизация avatar_url между cars и starline_devices
-- 1) Одноразово выравниваем avatar_url по текущим данным
UPDATE starline_devices AS sd
SET avatar_url = c.avatar_url,
    updated_at = NOW()
FROM cars AS c
WHERE sd.car_id = c.id
  AND COALESCE(sd.avatar_url, '') IS DISTINCT FROM COALESCE(c.avatar_url, '');

-- 2) Функция синхронизации avatar_url при изменении в cars
CREATE OR REPLACE FUNCTION sync_starline_device_avatar()
RETURNS trigger AS $$
BEGIN
  IF COALESCE(NEW.avatar_url, '') IS DISTINCT FROM COALESCE(OLD.avatar_url, '') THEN
    UPDATE starline_devices
    SET avatar_url = NEW.avatar_url,
        updated_at = NOW()
    WHERE car_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Триггер на обновление avatar_url в cars
DROP TRIGGER IF EXISTS trg_sync_starline_avatar ON cars;

CREATE TRIGGER trg_sync_starline_avatar
AFTER UPDATE OF avatar_url ON cars
FOR EACH ROW
EXECUTE FUNCTION sync_starline_device_avatar();


