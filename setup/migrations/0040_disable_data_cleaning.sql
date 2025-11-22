-- Миграция: Отключение trigger который очищает data
-- Дата: 2025-11-20
-- Описание: Отключаем trg_fill_bookings_from_jsonb который очищает data после обработки
--   data должен быть источником истины для всех 180+ полей из RentProg

-- Отключаем trigger
ALTER TABLE bookings DISABLE TRIGGER trg_fill_bookings_from_jsonb;

-- Комментарий
COMMENT ON TRIGGER trg_fill_bookings_from_jsonb ON bookings IS
  'DISABLED: This trigger was clearing data field after extracting values. Now data is the source of truth and must be preserved.';

