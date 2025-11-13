-- Добавление полей в таблицу bookings для парсинга RentProg API
-- Дата: 2025-11-13

-- Поля для дат и статусов
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS start_date_formatted TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS end_date_formatted TEXT;

-- Поля для клиента
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_category TEXT;

-- Поля для авто
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS car_name TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS car_code TEXT;

-- Поля для локаций
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS location_start TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS location_end TEXT;

-- Финансовые поля
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total NUMERIC;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit NUMERIC;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rental_cost NUMERIC;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS days INTEGER;

-- Статусы
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS in_rent BOOLEAN;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS archive BOOLEAN;

-- Ответственные
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS start_worker_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS end_worker_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS responsible TEXT;

-- Дополнительные данные
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source TEXT;

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_bookings_branch ON bookings(branch);
CREATE INDEX IF NOT EXISTS idx_bookings_is_active ON bookings(is_active);
CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_car_id ON bookings(car_id);
CREATE INDEX IF NOT EXISTS idx_bookings_start_date ON bookings(start_date);
CREATE INDEX IF NOT EXISTS idx_bookings_end_date ON bookings(end_date);
CREATE INDEX IF NOT EXISTS idx_bookings_state ON bookings(state);

-- Комментарии к полям
COMMENT ON COLUMN bookings.start_date_formatted IS 'Дата начала в формате RentProg (DD.MM.YYYY HH:MM)';
COMMENT ON COLUMN bookings.end_date_formatted IS 'Дата окончания в формате RentProg (DD.MM.YYYY HH:MM)';
COMMENT ON COLUMN bookings.client_name IS 'Полное имя клиента (Имя Отчество Фамилия)';
COMMENT ON COLUMN bookings.client_category IS 'Категория клиента';
COMMENT ON COLUMN bookings.car_name IS 'Название автомобиля';
COMMENT ON COLUMN bookings.car_code IS 'Код автомобиля';
COMMENT ON COLUMN bookings.location_start IS 'Место выдачи';
COMMENT ON COLUMN bookings.location_end IS 'Место возврата';
COMMENT ON COLUMN bookings.total IS 'Общая сумма';
COMMENT ON COLUMN bookings.deposit IS 'Депозит';
COMMENT ON COLUMN bookings.rental_cost IS 'Стоимость аренды';
COMMENT ON COLUMN bookings.days IS 'Количество дней аренды';
COMMENT ON COLUMN bookings.in_rent IS 'В аренде (выдано, не возвращено)';
COMMENT ON COLUMN bookings.archive IS 'В архиве';
COMMENT ON COLUMN bookings.start_worker_id IS 'ID сотрудника, выдавшего авто';
COMMENT ON COLUMN bookings.end_worker_id IS 'ID сотрудника, принявшего авто';
COMMENT ON COLUMN bookings.responsible IS 'Ответственный';
COMMENT ON COLUMN bookings.description IS 'Описание брони';
COMMENT ON COLUMN bookings.source IS 'Источник брони';

