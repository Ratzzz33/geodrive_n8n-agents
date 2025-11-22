-- Миграция 0037: Триггеры для автоматического обновления future_branch_id при изменении броней
-- Дата: 2025-01-XX
-- Описание: Триггеры на таблицу bookings для автоматического пересчёта future_branch_id

-- Функция-триггер для обработки изменений в bookings
CREATE OR REPLACE FUNCTION trigger_update_car_future_branch()
RETURNS TRIGGER AS $$
BEGIN
  -- Если это INSERT или UPDATE и есть car_id
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.car_id IS NOT NULL THEN
      -- Обновляем future_branch для этой машины
      PERFORM refresh_car_branch_state(NEW.car_id);
    END IF;
    
    -- Если это UPDATE и car_id изменился, обновляем и старую машину
    IF TG_OP = 'UPDATE' AND OLD.car_id IS NOT NULL AND OLD.car_id != NEW.car_id THEN
      PERFORM refresh_car_branch_state(OLD.car_id);
    END IF;
    
    RETURN NEW;
  END IF;
  
  -- Если это DELETE
  IF TG_OP = 'DELETE' THEN
    IF OLD.car_id IS NOT NULL THEN
      -- Обновляем future_branch для этой машины
      PERFORM refresh_car_branch_state(OLD.car_id);
    END IF;
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Триггер на INSERT
DROP TRIGGER IF EXISTS bookings_insert_update_future_branch ON bookings;
CREATE TRIGGER bookings_insert_update_future_branch
  AFTER INSERT ON bookings
  FOR EACH ROW
  WHEN (NEW.car_id IS NOT NULL AND NEW.status NOT IN ('cancelled', 'rejected', 'deleted'))
  EXECUTE FUNCTION trigger_update_car_future_branch();

-- Триггер на UPDATE
DROP TRIGGER IF EXISTS bookings_update_update_future_branch ON bookings;
CREATE TRIGGER bookings_update_update_future_branch
  AFTER UPDATE ON bookings
  FOR EACH ROW
  WHEN (
    (NEW.car_id IS NOT NULL AND NEW.status NOT IN ('cancelled', 'rejected', 'deleted'))
    OR (OLD.car_id IS NOT NULL AND OLD.status NOT IN ('cancelled', 'rejected', 'deleted'))
    OR (OLD.car_id != NEW.car_id)
    OR (OLD.start_at != NEW.start_at)
    OR (OLD.end_at != NEW.end_at)
    OR (OLD.status != NEW.status)
  )
  EXECUTE FUNCTION trigger_update_car_future_branch();

-- Триггер на DELETE
DROP TRIGGER IF EXISTS bookings_delete_update_future_branch ON bookings;
CREATE TRIGGER bookings_delete_update_future_branch
  AFTER DELETE ON bookings
  FOR EACH ROW
  WHEN (OLD.car_id IS NOT NULL AND OLD.status NOT IN ('cancelled', 'rejected', 'deleted'))
  EXECUTE FUNCTION trigger_update_car_future_branch();

-- Комментарии
COMMENT ON FUNCTION trigger_update_car_future_branch IS 'Триггерная функция для автоматического обновления future_branch_id при изменении броней';

