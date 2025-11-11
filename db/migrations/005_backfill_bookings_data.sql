-- =============================================
-- МИГРАЦИЯ: Бэкфилл данных в таблице bookings
-- Дата: 2025-11-10
-- Версия: 005
-- =============================================
--
-- ЦЕЛЬ: Окончательно заполнить все пустые поля используя COALESCE
--       и данные из других полей
--
-- ЛОГИКА:
-- 1. Заполнить start_date/end_date если еще остались NULL
-- 2. Заполнить start_at/end_at если еще остались NULL
-- 3. Заполнить state/status если еще остались NULL
-- 4. Пометить записи без данных для ручной проверки
--
-- ПРИМЕЧАНИЕ: Эта миграция - "последняя инстанция" для заполнения
--             всех возможных пропусков после предыдущих миграций
--
-- =============================================

BEGIN;

-- ============================================
-- ШАГ 1: Финальный бэкфилл дат
-- ============================================

UPDATE bookings
SET 
  -- Заполняем start_date из start_at (если еще NULL)
  start_date = COALESCE(
    start_date,
    CASE 
      WHEN start_at IS NOT NULL THEN 
        TO_CHAR(start_at AT TIME ZONE 'Asia/Tbilisi', 'YYYY-MM-DD HH24:MI:SS') || 
        CASE 
          WHEN EXTRACT(TIMEZONE_HOUR FROM start_at) >= 0 
          THEN '+' || LPAD(ABS(EXTRACT(TIMEZONE_HOUR FROM start_at))::INTEGER::text, 2, '0')
          ELSE LPAD(EXTRACT(TIMEZONE_HOUR FROM start_at)::INTEGER::text, 3, '0')
        END
      ELSE NULL
    END
  ),
  
  -- Заполняем end_date из end_at (если еще NULL)
  end_date = COALESCE(
    end_date,
    CASE 
      WHEN end_at IS NOT NULL THEN 
        TO_CHAR(end_at AT TIME ZONE 'Asia/Tbilisi', 'YYYY-MM-DD HH24:MI:SS') || 
        CASE 
          WHEN EXTRACT(TIMEZONE_HOUR FROM end_at) >= 0 
          THEN '+' || LPAD(ABS(EXTRACT(TIMEZONE_HOUR FROM end_at))::INTEGER::text, 2, '0')
          ELSE LPAD(EXTRACT(TIMEZONE_HOUR FROM end_at)::INTEGER::text, 3, '0')
        END
      ELSE NULL
    END
  ),
  
  -- Заполняем start_at из start_date (если еще NULL)
  start_at = COALESCE(
    start_at, 
    CASE 
      WHEN start_date IS NOT NULL 
           AND start_date ~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[+-]\d{2}$'
      THEN start_date::timestamptz 
      ELSE NULL 
    END
  ),
  
  -- Заполняем end_at из end_date (если еще NULL)
  end_at = COALESCE(
    end_at, 
    CASE 
      WHEN end_date IS NOT NULL 
           AND end_date ~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[+-]\d{2}$'
      THEN end_date::timestamptz 
      ELSE NULL 
    END
  )
WHERE (start_date IS NULL OR end_date IS NULL OR start_at IS NULL OR end_at IS NULL);

-- Логируем прогресс
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✅ Шаг 1: Финальный бэкфилл дат';
  RAISE NOTICE '   Обновлено записей: %', updated_count;
END $$;

-- ============================================
-- ШАГ 2: Финальный бэкфилл статусов
-- ============================================

UPDATE bookings
SET 
  -- Заполняем state из status (если еще NULL)
  state = COALESCE(
    state,
    CASE status
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
      ELSE status
    END,
    'Новая' -- Дефолтное значение если совсем нет данных
  ),
  
  -- Заполняем status из state (если еще NULL)
  status = COALESCE(
    status,
    CASE state
      WHEN 'Активная' THEN 'active'
      WHEN 'Новая' THEN 'active'
      WHEN 'Подтверждена' THEN 'confirmed'
      WHEN 'Отъездила' THEN 'completed'
      WHEN 'Отказ клиента' THEN 'cancelled'
      WHEN 'Отмена' THEN 'cancelled'
      WHEN 'Недозвон' THEN 'pending'
      WHEN 'Не подтверждена' THEN 'pending'
      WHEN 'Ожидает ответа клиента' THEN 'pending'
      WHEN 'active' THEN 'active'
      WHEN 'confirmed' THEN 'confirmed'
      WHEN 'in_rent' THEN 'in_rent'
      WHEN 'completed' THEN 'completed'
      WHEN 'cancelled' THEN 'cancelled'
      WHEN 'pending' THEN 'pending'
      ELSE LOWER(state)
    END,
    'active' -- Дефолтное значение если совсем нет данных
  )
WHERE (state IS NULL OR status IS NULL);

-- Логируем прогресс
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✅ Шаг 2: Финальный бэкфилл статусов';
  RAISE NOTICE '   Обновлено записей: %', updated_count;
END $$;

-- ============================================
-- ШАГ 3: Финальная проверка и статистика
-- ============================================

DO $$
DECLARE
  total_bookings INTEGER;
  null_dates_count INTEGER;
  null_status_count INTEGER;
  active_bookings INTEGER;
  completed_bookings INTEGER;
  cancelled_bookings INTEGER;
  records_needing_review INTEGER;
BEGIN
  -- Общее количество броней
  SELECT COUNT(*) INTO total_bookings FROM bookings;
  
  -- Брони с NULL в датах
  SELECT COUNT(*) INTO null_dates_count 
  FROM bookings 
  WHERE start_date IS NULL OR end_date IS NULL 
     OR start_at IS NULL OR end_at IS NULL;
  
  -- Брони с NULL в статусах
  SELECT COUNT(*) INTO null_status_count 
  FROM bookings 
  WHERE state IS NULL OR status IS NULL;
  
  -- Активные брони
  SELECT COUNT(*) INTO active_bookings
  FROM bookings
  WHERE state IN ('Активная', 'Новая', 'Подтверждена')
     OR status IN ('active', 'confirmed', 'in_rent');
  
  -- Завершенные брони
  SELECT COUNT(*) INTO completed_bookings
  FROM bookings
  WHERE state = 'Отъездила' OR status = 'completed';
  
  -- Отмененные брони
  SELECT COUNT(*) INTO cancelled_bookings
  FROM bookings
  WHERE state IN ('Отмена', 'Отказ клиента') OR status = 'cancelled';
  
  -- Записи требующие ручной проверки (где вообще нет данных)
  SELECT COUNT(*) INTO records_needing_review
  FROM bookings
  WHERE (start_date IS NULL AND start_at IS NULL)
     OR (end_date IS NULL AND end_at IS NULL);
  
  -- Выводим финальный отчет
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '📊 ФИНАЛЬНАЯ СТАТИСТИКА ПОСЛЕ ВСЕХ МИГРАЦИЙ';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📈 Общая информация:';
  RAISE NOTICE '   Всего броней в БД: %', total_bookings;
  RAISE NOTICE '';
  RAISE NOTICE '📅 Статус дат:';
  RAISE NOTICE '   С NULL в датах: %', null_dates_count;
  IF null_dates_count = 0 THEN
    RAISE NOTICE '   ✅ Все даты заполнены успешно!';
  ELSE
    RAISE WARNING '   ⚠️  % записей требуют ручной проверки дат', null_dates_count;
  END IF;
  RAISE NOTICE '';
  RAISE NOTICE '🏷️  Статус полей status/state:';
  RAISE NOTICE '   С NULL в статусах: %', null_status_count;
  IF null_status_count = 0 THEN
    RAISE NOTICE '   ✅ Все статусы заполнены успешно!';
  ELSE
    RAISE WARNING '   ⚠️  % записей требуют ручной проверки статусов', null_status_count;
  END IF;
  RAISE NOTICE '';
  RAISE NOTICE '📊 Распределение броней по статусам:';
  RAISE NOTICE '   Активные/Новые/Подтвержденные: % (%.1f%%)', 
    active_bookings, 
    (active_bookings::FLOAT / NULLIF(total_bookings, 0) * 100);
  RAISE NOTICE '   Завершенные: % (%.1f%%)', 
    completed_bookings, 
    (completed_bookings::FLOAT / NULLIF(total_bookings, 0) * 100);
  RAISE NOTICE '   Отмененные: % (%.1f%%)', 
    cancelled_bookings, 
    (cancelled_bookings::FLOAT / NULLIF(total_bookings, 0) * 100);
  RAISE NOTICE '';
  
  IF records_needing_review > 0 THEN
    RAISE WARNING '⚠️  ВНИМАНИЕ: % записей без дат - требуется ручная проверка!', records_needing_review;
    RAISE NOTICE '';
    RAISE NOTICE 'Выполните запрос для просмотра проблемных записей:';
    RAISE NOTICE 'SELECT id, start_date, end_date, start_at, end_at, state, status';
    RAISE NOTICE 'FROM bookings';
    RAISE NOTICE 'WHERE (start_date IS NULL AND start_at IS NULL)';
    RAISE NOTICE '   OR (end_date IS NULL AND end_at IS NULL);';
  ELSE
    RAISE NOTICE '✅ ВСЕ ДАННЫЕ НОРМАЛИЗОВАНЫ УСПЕШНО!';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 Поиск автомобилей теперь работает корректно!';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '✅ МИГРАЦИЯ 005 ЗАВЕРШЕНА';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
END $$;

COMMIT;

