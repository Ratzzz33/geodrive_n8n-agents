-- =============================================
-- МИГРАЦИЯ: Добавление полей для нормализации данных броней
-- Дата: 2025-11-10
-- Версия: 001
-- =============================================
-- 
-- ЦЕЛЬ: Добавить поля start_date, end_date, state для хранения 
--       дублирующих данных в текстовом формате (для совместимости с RentProg)
--
-- ПОЛЯ:
-- - start_date (TEXT) - дата начала в формате "YYYY-MM-DD HH24:MI:SS+TZ"
-- - end_date (TEXT) - дата окончания в формате "YYYY-MM-DD HH24:MI:SS+TZ"
-- - state (TEXT) - статус на русском языке (для RentProg)
--
-- =============================================

BEGIN;

-- Добавляем поле start_date (текстовый формат даты)
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS start_date TEXT;

-- Добавляем поле end_date (текстовый формат даты)
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS end_date TEXT;

-- Добавляем поле state (статус на русском)
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS state TEXT;

-- Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_bookings_state ON bookings(state);
CREATE INDEX IF NOT EXISTS idx_bookings_start_date ON bookings(start_date);
CREATE INDEX IF NOT EXISTS idx_bookings_end_date ON bookings(end_date);

-- Логируем результат
DO $$
BEGIN
  RAISE NOTICE '✅ Миграция 001 завершена успешно';
  RAISE NOTICE '   - Добавлено поле start_date (TEXT)';
  RAISE NOTICE '   - Добавлено поле end_date (TEXT)';
  RAISE NOTICE '   - Добавлено поле state (TEXT)';
  RAISE NOTICE '   - Созданы индексы для быстрого поиска';
END $$;

COMMIT;

