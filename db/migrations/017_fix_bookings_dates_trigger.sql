-- =============================================
-- МИГРАЦИЯ: Принудительная нормализация текстовых дат и обновление триггера
-- Дата: 2025-11-16
-- Версия: 017
-- =============================================
--
-- ЦЕЛИ:
-- 1. Привести все существующие значения start_date/end_date к ISO-формату
-- 2. Обновить функцию sync_booking_fields() так, чтобы:
--    - start_date/end_date всегда пересчитывались из start_at/end_at
--    - поддерживался парсинг формата DD-MM-YYYY HH:MM при отсутствии start_at/end_at
--
-- =============================================

BEGIN;

-- ============================================
-- ШАГ 1: Нормализация существующих строк
-- ============================================

WITH updated AS (
  UPDATE bookings
  SET
    -- Если отсутствует start_at, но есть текстовая дата в формате DD-MM-YYYY HH:MM, конвертируем в timestamptz
    start_at = CASE
      WHEN start_at IS NULL
       AND start_date ~ '^\d{2}-\d{2}-\d{4}'
      THEN to_timestamp(
        CONCAT(
          regexp_replace(start_date, '\s+(\d{1,2}:\d{2})', ' \1', 'g'),
          CASE 
            WHEN start_date ~ '\d{2}:\d{2}' THEN '' 
            ELSE ' 00:00'
          END,
          ' +04:00'
        ),
        'DD-MM-YYYY HH24:MI TZH:TZM'
      )
      ELSE start_at
    END,
    end_at = CASE
      WHEN end_at IS NULL
       AND end_date ~ '^\d{2}-\d{2}-\d{4}'
      THEN to_timestamp(
        CONCAT(
          regexp_replace(end_date, '\s+(\d{1,2}:\d{2})', ' \1', 'g'),
          CASE 
            WHEN end_date ~ '\d{2}:\d{2}' THEN '' 
            ELSE ' 00:00'
          END,
          ' +04:00'
        ),
        'DD-MM-YYYY HH24:MI TZH:TZM'
      )
      ELSE end_at
    END
  WHERE (start_date ~ '^\d{2}-\d{2}-\d{4}') OR (end_date ~ '^\d{2}-\d{2}-\d{4}')
  RETURNING 1
)
UPDATE bookings
SET
  start_date = TO_CHAR(start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') || '+00',
  end_date = TO_CHAR(end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') || '+00'
WHERE start_at IS NOT NULL 
  AND end_at IS NOT NULL
  AND (
    start_date IS NULL OR end_date IS NULL OR
    start_date ~ '^\d{2}-\d{2}-\d{4}' OR
    end_date ~ '^\d{2}-\d{2}-\d{4}'
  );

-- ============================================
-- ШАГ 2: Обновление триггера синхронизации
-- ============================================

DROP TRIGGER IF EXISTS bookings_sync_fields_trigger ON bookings;
DROP FUNCTION IF EXISTS sync_booking_fields();

CREATE OR REPLACE FUNCTION sync_booking_fields()
RETURNS TRIGGER AS $$
DECLARE
  clean_start_date TEXT;
  clean_end_date TEXT;
BEGIN
  -- ============================================
  -- 1. start_at/end_at → start_date/end_date
  -- ============================================
  IF NEW.start_at IS NOT NULL THEN
    NEW.start_date := TO_CHAR(NEW.start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') || '+00';
  END IF;
  
  IF NEW.end_at IS NOT NULL THEN
    NEW.end_date := TO_CHAR(NEW.end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') || '+00';
  END IF;

  -- ============================================
  -- 2. start_date/end_date → start_at/end_at
  -- ============================================
  IF NEW.start_at IS NULL AND NEW.start_date IS NOT NULL THEN
    IF NEW.start_date ~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[+-]\d{2}$' THEN
      NEW.start_at := NEW.start_date::timestamptz;
    ELSIF NEW.start_date ~ '^\d{2}-\d{2}-\d{4}' THEN
      clean_start_date := CASE
        WHEN NEW.start_date ~ '\d{2}:\d{2}'
        THEN NEW.start_date
        ELSE NEW.start_date || ' 00:00'
      END;
      NEW.start_at := to_timestamp(clean_start_date || ' +04:00', 'DD-MM-YYYY HH24:MI TZH:TZM');
    END IF;
    
    IF NEW.start_at IS NOT NULL THEN
      NEW.start_date := TO_CHAR(NEW.start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') || '+00';
    END IF;
  END IF;

  IF NEW.end_at IS NULL AND NEW.end_date IS NOT NULL THEN
    IF NEW.end_date ~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[+-]\d{2}$' THEN
      NEW.end_at := NEW.end_date::timestamptz;
    ELSIF NEW.end_date ~ '^\d{2}-\d{2}-\d{4}' THEN
      clean_end_date := CASE
        WHEN NEW.end_date ~ '\d{2}:\d{2}'
        THEN NEW.end_date
        ELSE NEW.end_date || ' 00:00'
      END;
      NEW.end_at := to_timestamp(clean_end_date || ' +04:00', 'DD-MM-YYYY HH24:MI TZH:TZM');
    END IF;
    
    IF NEW.end_at IS NOT NULL THEN
      NEW.end_date := TO_CHAR(NEW.end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') || '+00';
    END IF;
  END IF;

  -- ============================================
  -- 3. Статусы (status -> state)
  -- ============================================
  IF NEW.state IS NULL AND NEW.status IS NOT NULL THEN
    NEW.state := CASE NEW.status
      WHEN 'active' THEN 'Активная'
      WHEN 'confirmed' THEN 'Подтверждена'
      WHEN 'in_rent' THEN 'Активная'
      WHEN 'completed' THEN 'Отъездила'
      WHEN 'cancelled' THEN 'Отмена'
      WHEN 'pending' THEN 'Новая'
      WHEN 'Активная' THEN 'Активная'
      WHEN 'Новая' THEN 'Новая'
      WHEN 'Подтверждена' THEN 'Подтверждена'
      WHEN 'Отъездила' THEN 'Отъездила'
      WHEN 'Отмена' THEN 'Отмена'
      WHEN 'Отказ клиента' THEN 'Отказ клиента'
      ELSE NEW.status
    END;
  END IF;

  -- ============================================
  -- 4. Статусы (state -> status)
  -- ============================================
  IF NEW.status IS NULL AND NEW.state IS NOT NULL THEN
    NEW.status := CASE NEW.state
      WHEN 'Активная' THEN 'active'
      WHEN 'Новая' THEN 'active'
      WHEN 'Подтверждена' THEN 'confirmed'
      WHEN 'Отъездила' THEN 'completed'
      WHEN 'Отказ клиента' THEN 'cancelled'
      WHEN 'Отмена' THEN 'cancelled'
      WHEN 'Недозвон' THEN 'pending'
      WHEN 'Не подтверждена' THEN 'pending'
      WHEN 'Ожидает ответа клиента' THEN 'pending'
      WHEN 'Ожидает ответа' THEN 'pending'
      WHEN 'active' THEN 'active'
      WHEN 'confirmed' THEN 'confirmed'
      WHEN 'in_rent' THEN 'in_rent'
      WHEN 'completed' THEN 'completed'
      WHEN 'cancelled' THEN 'cancelled'
      WHEN 'pending' THEN 'pending'
      ELSE LOWER(NEW.state)
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookings_sync_fields_trigger
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION sync_booking_fields();

COMMIT;


