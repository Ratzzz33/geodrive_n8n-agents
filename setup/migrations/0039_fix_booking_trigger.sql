-- Миграция: Исправление trigger для bookings
-- Дата: 2025-11-20
-- Описание: Создание нового упрощенного trigger который:
--   1. Работает с плоской структурой (car_id, client_id - числа в data)
--   2. Связывает bookings с cars/clients через UUID (если external_refs существует)
--   3. НЕ очищает data (сохраняет все 180+ полей из RentProg)

-- Удаляем старый сломанный trigger
DROP TRIGGER IF EXISTS process_booking_nested_entities_trigger ON bookings;

-- Создаем новую упрощенную функцию
CREATE OR REPLACE FUNCTION link_booking_entities()
RETURNS TRIGGER AS $$
DECLARE
  rp_car_id TEXT;
  rp_client_id TEXT;
  car_uuid UUID;
  client_uuid UUID;
BEGIN
  -- Проверяем что data - это объект (не scalar)
  IF jsonb_typeof(NEW.data) != 'object' THEN
    RAISE WARNING 'Booking %: data is not an object (type: %), skipping entity linking', NEW.rentprog_id, jsonb_typeof(NEW.data);
    RETURN NEW;
  END IF;

  -- ========== ОБРАБОТКА CAR ==========
  -- Извлекаем car_id из data (плоская структура)
  IF NEW.data ? 'car_id' THEN
    rp_car_id := NEW.data->>'car_id';
    
    IF rp_car_id IS NOT NULL AND rp_car_id != 'null' AND rp_car_id != '' THEN
      -- Ищем UUID машины через external_refs
      SELECT entity_id INTO car_uuid
      FROM external_refs
      WHERE system = 'rentprog'
        AND entity_type = 'car'
        AND external_id = rp_car_id;
      
      IF car_uuid IS NOT NULL THEN
        NEW.car_id := car_uuid;
        RAISE DEBUG 'Booking %: linked to car UUID % (RentProg ID: %)', NEW.rentprog_id, car_uuid, rp_car_id;
      ELSE
        RAISE DEBUG 'Booking %: car with RentProg ID % not found in external_refs', NEW.rentprog_id, rp_car_id;
      END IF;
    END IF;
  END IF;

  -- ========== ОБРАБОТКА CLIENT ==========
  -- Извлекаем client_id из data (плоская структура)
  IF NEW.data ? 'client_id' THEN
    rp_client_id := NEW.data->>'client_id';
    
    IF rp_client_id IS NOT NULL AND rp_client_id != 'null' AND rp_client_id != '' THEN
      -- Ищем UUID клиента через external_refs
      SELECT entity_id INTO client_uuid
      FROM external_refs
      WHERE system = 'rentprog'
        AND entity_type = 'client'
        AND external_id = rp_client_id;
      
      IF client_uuid IS NOT NULL THEN
        NEW.client_id := client_uuid;
        RAISE DEBUG 'Booking %: linked to client UUID % (RentProg ID: %)', NEW.rentprog_id, client_uuid, rp_client_id;
      ELSE
        RAISE DEBUG 'Booking %: client with RentProg ID % not found in external_refs', NEW.rentprog_id, rp_client_id;
      END IF;
    END IF;
  END IF;

  -- ✅ НЕ ОЧИЩАЕМ data - это источник истины!
  -- data сохраняется со всеми 180+ полями из RentProg
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем новый trigger
CREATE TRIGGER link_booking_entities_trigger
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION link_booking_entities();

-- Комментарии для документации
COMMENT ON FUNCTION link_booking_entities() IS 
  'Связывает bookings с cars/clients через UUID на основе RentProg ID из data. НЕ очищает data.';

COMMENT ON TRIGGER link_booking_entities_trigger ON bookings IS
  'Автоматически связывает брони с машинами и клиентами если они существуют в external_refs';

