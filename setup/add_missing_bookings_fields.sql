-- Добавление недостающих полей в таблицу bookings
-- Дата: 2025-11-13

-- Основные поля
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS branch TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS number TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS state TEXT;

-- Поля для дат (если их нет)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE;

-- Клиент
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_name TEXT;

-- Индексы
CREATE INDEX IF NOT EXISTS idx_bookings_branch ON bookings(branch);
CREATE INDEX IF NOT EXISTS idx_bookings_number ON bookings(number);
CREATE INDEX IF NOT EXISTS idx_bookings_is_active ON bookings(is_active);
CREATE INDEX IF NOT EXISTS idx_bookings_state ON bookings(state);

-- Комментарии
COMMENT ON COLUMN bookings.branch IS 'Код филиала (tbilisi, batumi, kutaisi, service-center)';
COMMENT ON COLUMN bookings.number IS 'Номер брони в RentProg';
COMMENT ON COLUMN bookings.is_active IS 'Активна ли бронь (active/inactive)';
COMMENT ON COLUMN bookings.state IS 'Состояние брони (planned, issued, returned, cancelled)';
COMMENT ON COLUMN bookings.start_date IS 'Дата начала (timestamp)';
COMMENT ON COLUMN bookings.end_date IS 'Дата окончания (timestamp)';
COMMENT ON COLUMN bookings.client_name IS 'Полное имя клиента';

