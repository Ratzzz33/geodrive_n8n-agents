-- =============================================
-- МИГРАЦИЯ: Исправление часового пояса на Asia/Tbilisi
-- Дата: 2025-11-21
-- Версия: 018
-- =============================================
--
-- ЦЕЛИ:
-- 1. Исправить функцию sync_booking_fields() - использовать Asia/Tbilisi вместо UTC
-- 2. Обновить все существующие start_date/end_date с +00 на +04
--
-- ПРОБЛЕМА:
-- Миграция 017 использовала UTC вместо Asia/Tbilisi, что приводило к неправильному
-- сохранению времени в текстовых полях start_date/end_date
--
-- =============================================

BEGIN;

-- ============================================
-- ШАГ 1: Обновление существующих записей
-- ============================================

UPDATE bookings
SET
  -- Конвертируем start_date из UTC в Asia/Tbilisi
  start_date = CASE
    WHEN start_at IS NOT NULL THEN
      TO_CHAR(start_at AT TIME ZONE 'Asia/Tbilisi', 'YYYY-MM-DD HH24:MI:SS') || '+04'
    WHEN start_date IS NOT NULL AND start_date LIKE '%+00' THEN
      -- Конвертируем существующий UTC формат в Asia/Tbilisi
      TO_CHAR((start_date::timestamptz) AT TIME ZONE 'Asia/Tbilisi', 'YYYY-MM-DD HH24:MI:SS') || '+04'
    ELSE start_date
  END,
  -- Конвертируем end_date из UTC в Asia/Tbilisi
  end_date = CASE
    WHEN end_at IS NOT NULL THEN
      TO_CHAR(end_at AT TIME ZONE 'Asia/Tbilisi', 'YYYY-MM-DD HH24:MI:SS') || '+04'
    WHEN end_date IS NOT NULL AND end_date LIKE '%+00' THEN
      -- Конвертируем существующий UTC формат в Asia/Tbilisi
      TO_CHAR((end_date::timestamptz) AT TIME ZONE 'Asia/Tbilisi', 'YYYY-MM-DD HH24:MI:SS') || '+04'
    ELSE end_date
  END
WHERE (start_date LIKE '%+00' OR end_date LIKE '%+00')
   OR (start_at IS NOT NULL AND (start_date IS NULL OR start_date NOT LIKE '%+04'))
   OR (end_at IS NOT NULL AND (end_date IS NULL OR end_date NOT LIKE '%+04'));

-- ============================================
-- ШАГ 2: Обновление функции триггера
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
    -- ВАЖНО: Используем Asia/Tbilisi, а не UTC!
    NEW.start_date := TO_CHAR(NEW.start_at AT TIME ZONE 'Asia/Tbilisi', 'YYYY-MM-DD HH24:MI:SS') || '+04';
  END IF;
  
  IF NEW.end_at IS NOT NULL THEN
    -- ВАЖНО: Используем Asia/Tbilisi, а не UTC!
    NEW.end_date := TO_CHAR(NEW.end_at AT TIME ZONE 'Asia/Tbilisi', 'YYYY-MM-DD HH24:MI:SS') || '+04';
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
      -- ВАЖНО: RentProg всегда использует Asia/Tbilisi (UTC+4)
      NEW.start_at := to_timestamp(clean_start_date || ' +04:00', 'DD-MM-YYYY HH24:MI TZH:TZM');
    END IF;
    
    -- После парсинга обновляем start_date в правильном формате
    IF NEW.start_at IS NOT NULL THEN
      NEW.start_date := TO_CHAR(NEW.start_at AT TIME ZONE 'Asia/Tbilisi', 'YYYY-MM-DD HH24:MI:SS') || '+04';
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
      -- ВАЖНО: RentProg всегда использует Asia/Tbilisi (UTC+4)
      NEW.end_at := to_timestamp(clean_end_date || ' +04:00', 'DD-MM-YYYY HH24:MI TZH:TZM');
    END IF;
    
    -- После парсинга обновляем end_date в правильном формате
    IF NEW.end_at IS NOT NULL THEN
      NEW.end_date := TO_CHAR(NEW.end_at AT TIME ZONE 'Asia/Tbilisi', 'YYYY-MM-DD HH24:MI:SS') || '+04';
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

-- Логируем результат
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM bookings
  WHERE start_date LIKE '%+04' OR end_date LIKE '%+04';
  
  RAISE NOTICE '✅ Миграция 018 завершена успешно';
  RAISE NOTICE '   Обновлено записей с форматом +04: %', updated_count;
END $$;

COMMIT;

