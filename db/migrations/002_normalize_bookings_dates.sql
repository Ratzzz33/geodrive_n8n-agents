-- =============================================
-- МИГРАЦИЯ: Нормализация дат в таблице bookings
-- Дата: 2025-11-10
-- Версия: 002
-- =============================================
--
-- ЦЕЛЬ: Заполнить пустые поля start_date/end_date из start_at/end_at
--       и наоборот, привести все к единому формату
--
-- ФОРМАТ ДАТ: "YYYY-MM-DD HH24:MI:SS+TZ"
-- Пример: "2025-11-10 16:00:00+04"
--
-- ЛОГИКА:
-- 1. Если start_date/end_date = NULL, но start_at/end_at заполнены
--    → конвертируем timestamp в text формат
-- 2. Если start_at/end_at = NULL, но start_date/end_date заполнены
--    → конвертируем text в timestamptz
--
-- =============================================

BEGIN;

-- ============================================
-- ШАГ 1: Заполнить start_date/end_date из start_at/end_at
-- ============================================

UPDATE bookings
SET 
  start_date = TO_CHAR(start_at AT TIME ZONE 'Asia/Tbilisi', 'YYYY-MM-DD HH24:MI:SS') || 
    CASE 
      WHEN EXTRACT(TIMEZONE_HOUR FROM start_at) >= 0 
      THEN '+' || LPAD(ABS(EXTRACT(TIMEZONE_HOUR FROM start_at))::INTEGER::text, 2, '0')
      ELSE LPAD(EXTRACT(TIMEZONE_HOUR FROM start_at)::INTEGER::text, 3, '0')
    END,
  end_date = TO_CHAR(end_at AT TIME ZONE 'Asia/Tbilisi', 'YYYY-MM-DD HH24:MI:SS') || 
    CASE 
      WHEN EXTRACT(TIMEZONE_HOUR FROM end_at) >= 0 
      THEN '+' || LPAD(ABS(EXTRACT(TIMEZONE_HOUR FROM end_at))::INTEGER::text, 2, '0')
      ELSE LPAD(EXTRACT(TIMEZONE_HOUR FROM end_at)::INTEGER::text, 3, '0')
    END
WHERE (start_date IS NULL OR end_date IS NULL)
  AND start_at IS NOT NULL 
  AND end_at IS NOT NULL;

-- Логируем прогресс
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✅ Шаг 1: Заполнено start_date/end_date из timestamp';
  RAISE NOTICE '   Обновлено записей: %', updated_count;
END $$;

-- ============================================
-- ШАГ 2: Заполнить start_at/end_at из start_date/end_date
-- ============================================

UPDATE bookings
SET 
  start_at = start_date::timestamptz,
  end_at = end_date::timestamptz
WHERE (start_at IS NULL OR end_at IS NULL)
  AND start_date IS NOT NULL 
  AND end_date IS NOT NULL
  AND start_date ~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[+-]\d{2}$'; -- Проверка формата

-- Логируем прогресс
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✅ Шаг 2: Заполнено start_at/end_at из text';
  RAISE NOTICE '   Обновлено записей: %', updated_count;
END $$;

-- ============================================
-- ШАГ 3: Проверка результатов
-- ============================================

DO $$
DECLARE
  null_start_date_count INTEGER;
  null_start_at_count INTEGER;
  total_count INTEGER;
BEGIN
  -- Считаем общее количество броней
  SELECT COUNT(*) INTO total_count FROM bookings;
  
  -- Считаем записи с NULL в start_date/end_date
  SELECT COUNT(*) INTO null_start_date_count 
  FROM bookings 
  WHERE start_date IS NULL OR end_date IS NULL;
  
  -- Считаем записи с NULL в start_at/end_at
  SELECT COUNT(*) INTO null_start_at_count 
  FROM bookings 
  WHERE start_at IS NULL OR end_at IS NULL;
  
  RAISE NOTICE '📊 Статистика после миграции:';
  RAISE NOTICE '   Всего броней: %', total_count;
  RAISE NOTICE '   С NULL в start_date/end_date: %', null_start_date_count;
  RAISE NOTICE '   С NULL в start_at/end_at: %', null_start_at_count;
  
  IF null_start_date_count > 0 OR null_start_at_count > 0 THEN
    RAISE WARNING '⚠️  Остались записи с NULL - требуется ручная проверка';
  ELSE
    RAISE NOTICE '✅ Все даты нормализованы успешно!';
  END IF;
END $$;

COMMIT;

