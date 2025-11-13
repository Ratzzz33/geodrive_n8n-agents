-- Миграция: добавление полей для технических броней
-- Дата: 2025-11-13

-- Добавляем поля
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_technical BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS technical_type TEXT DEFAULT 'regular';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS technical_purpose TEXT;

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_bookings_is_technical ON bookings(is_technical);
CREATE INDEX IF NOT EXISTS idx_bookings_technical_type ON bookings(technical_type);

-- Комментарии
COMMENT ON COLUMN bookings.is_technical IS 'Флаг технической брони (определяется по клиенту "Сервис" или "Сотрудник")';
COMMENT ON COLUMN bookings.technical_type IS 'Тип: regular (обычная), technical (служебная), technical_repair (для ремонта)';
COMMENT ON COLUMN bookings.technical_purpose IS 'Цель технической брони (service, repair, employee_trip, etc)';

-- Обновляем существующие записи на основе имени клиента
UPDATE bookings
SET 
  is_technical = TRUE,
  technical_type = CASE
    WHEN LOWER(client_name) LIKE '%сервис%' OR LOWER(description) LIKE '%ремонт%' THEN 'technical_repair'
    WHEN LOWER(client_name) LIKE '%сотрудник%' OR LOWER(client_name) LIKE '%employee%' THEN 'technical'
    ELSE 'technical'
  END
WHERE 
  LOWER(client_name) LIKE '%сервис%' OR 
  LOWER(client_name) LIKE '%сотрудник%' OR
  LOWER(client_name) LIKE '%service%' OR
  LOWER(client_name) LIKE '%employee%';

-- Логируем результаты
DO $$
DECLARE
  total_technical INTEGER;
  technical_repair INTEGER;
  technical_regular INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_technical FROM bookings WHERE is_technical = TRUE;
  SELECT COUNT(*) INTO technical_repair FROM bookings WHERE technical_type = 'technical_repair';
  SELECT COUNT(*) INTO technical_regular FROM bookings WHERE technical_type = 'technical';
  
  RAISE NOTICE '✅ Миграция завершена!';
  RAISE NOTICE '📊 Всего технических броней: %', total_technical;
  RAISE NOTICE '🔧 Для ремонта: %', technical_repair;
  RAISE NOTICE '🚗 Служебных: %', technical_regular;
END $$;

