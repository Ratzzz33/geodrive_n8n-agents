-- =============================================
-- МИГРАЦИЯ: Нормализация статусов в таблице bookings
-- Дата: 2025-11-10
-- Версия: 003
-- =============================================
--
-- ЦЕЛЬ: Заполнить пустые поля state/status друг из друга
--       с правильным маппингом русских и английских значений
--
-- МАППИНГ СТАТУСОВ:
-- state (русский)        -> status (английский)
-- 'Активная'             -> 'active'
-- 'Новая'                -> 'active'
-- 'Подтверждена'         -> 'confirmed'
-- 'Отъездила'            -> 'completed'
-- 'Отказ клиента'        -> 'cancelled'
-- 'Отмена'               -> 'cancelled'
-- 'Недозвон'             -> 'pending'
-- 'Не подтверждена'      -> 'pending'
-- 'Ожидает ответа'       -> 'pending'
--
-- ОБРАТНЫЙ МАППИНГ:
-- status                 -> state
-- 'active'               -> 'Активная'
-- 'confirmed'            -> 'Подтверждена'
-- 'in_rent'              -> 'Активная'
-- 'completed'            -> 'Отъездила'
-- 'cancelled'            -> 'Отмена'
-- 'pending'              -> 'Новая'
--
-- =============================================

BEGIN;

-- ============================================
-- ШАГ 1: Заполнить state из status
-- ============================================

UPDATE bookings
SET state = CASE 
  WHEN status = 'active' THEN 'Активная'
  WHEN status = 'confirmed' THEN 'Подтверждена'
  WHEN status = 'in_rent' THEN 'Активная'
  WHEN status = 'completed' THEN 'Отъездила'
  WHEN status = 'cancelled' THEN 'Отмена'
  WHEN status = 'pending' THEN 'Новая'
  -- Если status уже на русском, оставляем как есть
  WHEN status IN ('Активная', 'Новая', 'Подтверждена', 'Отъездила', 
                  'Отмена', 'Отказ клиента', 'Недозвон', 'Не подтверждена',
                  'Ожидает ответа клиента') THEN status
  -- Неизвестный статус - оставляем как есть
  ELSE status
END
WHERE state IS NULL 
  AND status IS NOT NULL;

-- Логируем прогресс
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✅ Шаг 1: Заполнено state из status';
  RAISE NOTICE '   Обновлено записей: %', updated_count;
END $$;

-- ============================================
-- ШАГ 2: Заполнить status из state
-- ============================================

UPDATE bookings
SET status = CASE 
  WHEN state = 'Активная' THEN 'active'
  WHEN state = 'Новая' THEN 'active'
  WHEN state = 'Подтверждена' THEN 'confirmed'
  WHEN state = 'Отъездила' THEN 'completed'
  WHEN state = 'Отказ клиента' THEN 'cancelled'
  WHEN state = 'Отмена' THEN 'cancelled'
  WHEN state = 'Недозвон' THEN 'pending'
  WHEN state = 'Не подтверждена' THEN 'pending'
  WHEN state = 'Ожидает ответа клиента' THEN 'pending'
  WHEN state = 'Ожидает ответа' THEN 'pending'
  -- Если state уже на английском, оставляем как есть
  WHEN state IN ('active', 'confirmed', 'in_rent', 'completed', 
                 'cancelled', 'pending') THEN state
  -- Неизвестный статус - пытаемся привести к нижнему регистру
  ELSE LOWER(state)
END
WHERE status IS NULL 
  AND state IS NOT NULL;

-- Логируем прогресс
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✅ Шаг 2: Заполнено status из state';
  RAISE NOTICE '   Обновлено записей: %', updated_count;
END $$;

-- ============================================
-- ШАГ 3: Проверка результатов
-- ============================================

DO $$
DECLARE
  null_state_count INTEGER;
  null_status_count INTEGER;
  total_count INTEGER;
  active_bookings INTEGER;
BEGIN
  -- Считаем общее количество броней
  SELECT COUNT(*) INTO total_count FROM bookings;
  
  -- Считаем записи с NULL в state
  SELECT COUNT(*) INTO null_state_count 
  FROM bookings 
  WHERE state IS NULL;
  
  -- Считаем записи с NULL в status
  SELECT COUNT(*) INTO null_status_count 
  FROM bookings 
  WHERE status IS NULL;
  
  -- Считаем активные брони (для проверки поиска)
  SELECT COUNT(*) INTO active_bookings
  FROM bookings
  WHERE state IN ('Активная', 'Новая', 'Подтверждена')
     OR status IN ('active', 'confirmed', 'in_rent', 'Активная', 'Новая', 'Подтверждена');
  
  RAISE NOTICE '📊 Статистика после миграции:';
  RAISE NOTICE '   Всего броней: %', total_count;
  RAISE NOTICE '   С NULL в state: %', null_state_count;
  RAISE NOTICE '   С NULL в status: %', null_status_count;
  RAISE NOTICE '   Активных броней (исключаемых из поиска): %', active_bookings;
  
  IF null_state_count > 0 OR null_status_count > 0 THEN
    RAISE WARNING '⚠️  Остались записи с NULL - требуется ручная проверка';
  ELSE
    RAISE NOTICE '✅ Все статусы нормализованы успешно!';
  END IF;
END $$;

-- ============================================
-- ШАГ 4: Вывод примеров для верификации
-- ============================================

DO $$
DECLARE
  rec RECORD;
  counter INTEGER := 0;
BEGIN
  RAISE NOTICE '📝 Примеры нормализованных статусов (первые 10):';
  
  FOR rec IN 
    SELECT id, state, status 
    FROM bookings 
    WHERE state IS NOT NULL AND status IS NOT NULL
    LIMIT 10
  LOOP
    counter := counter + 1;
    RAISE NOTICE '   %: state=%, status=%', counter, rec.state, rec.status;
  END LOOP;
END $$;

COMMIT;

