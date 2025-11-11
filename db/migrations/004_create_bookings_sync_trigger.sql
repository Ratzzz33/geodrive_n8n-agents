-- =============================================
-- МИГРАЦИЯ: Создание триггера для автоматической синхронизации полей
-- Дата: 2025-11-10
-- Версия: 004
-- =============================================
--
-- ЦЕЛЬ: Автоматически синхронизировать поля при INSERT/UPDATE:
--       - start_at/end_at <-> start_date/end_date
--       - state <-> status
--
-- ЛОГИКА:
-- 1. При заполнении start_at/end_at → автоматически заполнить start_date/end_date
-- 2. При заполнении start_date/end_date → автоматически заполнить start_at/end_at
-- 3. При заполнении state → автоматически заполнить status
-- 4. При заполнении status → автоматически заполнить state
--
-- ПРИОРИТЕТ: Если оба поля заполнены, используется более точное (timestamp)
--
-- =============================================

BEGIN;

-- ============================================
-- Удаляем старый триггер (если существует)
-- ============================================

DROP TRIGGER IF EXISTS bookings_sync_fields_trigger ON bookings;
DROP FUNCTION IF EXISTS sync_booking_fields();

-- ============================================
-- Создаем функцию синхронизации
-- ============================================

CREATE OR REPLACE FUNCTION sync_booking_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- ============================================
  -- 1. СИНХРОНИЗАЦИЯ ДАТ: start_at/end_at -> start_date/end_date
  -- ============================================
  
  -- Если заполнены timestamp поля, но пусты text поля
  IF (NEW.start_at IS NOT NULL AND NEW.end_at IS NOT NULL) 
     AND (NEW.start_date IS NULL OR NEW.end_date IS NULL) THEN
    
    -- Конвертируем timestamp в text формат "YYYY-MM-DD HH24:MI:SS+TZ"
    NEW.start_date := TO_CHAR(NEW.start_at AT TIME ZONE 'Asia/Tbilisi', 'YYYY-MM-DD HH24:MI:SS') || 
      CASE 
        WHEN EXTRACT(TIMEZONE_HOUR FROM NEW.start_at) >= 0 
        THEN '+' || LPAD(ABS(EXTRACT(TIMEZONE_HOUR FROM NEW.start_at))::INTEGER::text, 2, '0')
        ELSE LPAD(EXTRACT(TIMEZONE_HOUR FROM NEW.start_at)::INTEGER::text, 3, '0')
      END;
      
    NEW.end_date := TO_CHAR(NEW.end_at AT TIME ZONE 'Asia/Tbilisi', 'YYYY-MM-DD HH24:MI:SS') || 
      CASE 
        WHEN EXTRACT(TIMEZONE_HOUR FROM NEW.end_at) >= 0 
        THEN '+' || LPAD(ABS(EXTRACT(TIMEZONE_HOUR FROM NEW.end_at))::INTEGER::text, 2, '0')
        ELSE LPAD(EXTRACT(TIMEZONE_HOUR FROM NEW.end_at)::INTEGER::text, 3, '0')
      END;
  END IF;

  -- ============================================
  -- 2. СИНХРОНИЗАЦИЯ ДАТ: start_date/end_date -> start_at/end_at
  -- ============================================
  
  -- Если заполнены text поля, но пусты timestamp поля
  IF (NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL) 
     AND (NEW.start_at IS NULL OR NEW.end_at IS NULL)
     -- Проверяем что формат правильный
     AND NEW.start_date ~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[+-]\d{2}$'
     AND NEW.end_date ~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[+-]\d{2}$' THEN
    
    -- Конвертируем text в timestamptz
    NEW.start_at := NEW.start_date::timestamptz;
    NEW.end_at := NEW.end_date::timestamptz;
  END IF;

  -- ============================================
  -- 3. СИНХРОНИЗАЦИЯ СТАТУСОВ: status -> state
  -- ============================================
  
  -- Если заполнен status, но пуст state
  IF NEW.state IS NULL AND NEW.status IS NOT NULL THEN
    NEW.state := CASE NEW.status
      -- Стандартные английские статусы -> русские
      WHEN 'active' THEN 'Активная'
      WHEN 'confirmed' THEN 'Подтверждена'
      WHEN 'in_rent' THEN 'Активная'
      WHEN 'completed' THEN 'Отъездила'
      WHEN 'cancelled' THEN 'Отмена'
      WHEN 'pending' THEN 'Новая'
      -- Если уже на русском - оставляем
      WHEN 'Активная' THEN 'Активная'
      WHEN 'Новая' THEN 'Новая'
      WHEN 'Подтверждена' THEN 'Подтверждена'
      WHEN 'Отъездила' THEN 'Отъездила'
      WHEN 'Отмена' THEN 'Отмена'
      WHEN 'Отказ клиента' THEN 'Отказ клиента'
      -- Неизвестный статус - оставляем как есть
      ELSE NEW.status
    END;
  END IF;

  -- ============================================
  -- 4. СИНХРОНИЗАЦИЯ СТАТУСОВ: state -> status
  -- ============================================
  
  -- Если заполнен state, но пуст status
  IF NEW.status IS NULL AND NEW.state IS NOT NULL THEN
    NEW.status := CASE NEW.state
      -- Русские статусы -> английские
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
      -- Если уже на английском - оставляем
      WHEN 'active' THEN 'active'
      WHEN 'confirmed' THEN 'confirmed'
      WHEN 'in_rent' THEN 'in_rent'
      WHEN 'completed' THEN 'completed'
      WHEN 'cancelled' THEN 'cancelled'
      WHEN 'pending' THEN 'pending'
      -- Неизвестный статус - приводим к нижнему регистру
      ELSE LOWER(NEW.state)
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Создаем триггер на INSERT и UPDATE
-- ============================================

CREATE TRIGGER bookings_sync_fields_trigger
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION sync_booking_fields();

-- ============================================
-- Логирование
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Миграция 004 завершена успешно';
  RAISE NOTICE '   - Создана функция sync_booking_fields()';
  RAISE NOTICE '   - Создан триггер bookings_sync_fields_trigger';
  RAISE NOTICE '   - Триггер срабатывает на INSERT и UPDATE';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Теперь при создании/обновлении брони:';
  RAISE NOTICE '   - start_at/end_at автоматически -> start_date/end_date';
  RAISE NOTICE '   - start_date/end_date автоматически -> start_at/end_at';
  RAISE NOTICE '   - state автоматически -> status';
  RAISE NOTICE '   - status автоматически -> state';
END $$;

COMMIT;

