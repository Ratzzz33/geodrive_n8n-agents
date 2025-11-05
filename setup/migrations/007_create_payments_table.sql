-- Миграция 007: Таблица платежей компании
-- Центральная таблица всех платежей по филиалам из кассы RentProg

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Связи с другими таблицами
  branch_code TEXT NOT NULL,
  employee_id UUID REFERENCES employees(id),
  booking_id UUID REFERENCES bookings(id),
  client_id UUID REFERENCES clients(id),
  
  -- Данные из RentProg
  rentprog_payment_id TEXT,
  payment_date TIMESTAMPTZ NOT NULL,
  
  -- Тип и метод платежа
  payment_type TEXT NOT NULL, -- 'income' | 'expense' | 'transfer'
  payment_method TEXT NOT NULL, -- 'cash' | 'card' | 'bank_transfer' | 'other'
  
  -- Суммы
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GEL', -- 'GEL' | 'USD' | 'EUR'
  
  -- Описание
  description TEXT,
  comment TEXT,
  category TEXT, -- Категория платежа (аренда, ремонт, топливо и т.д.)
  
  -- Метаданные
  raw_data JSONB, -- Полные данные из RentProg UI
  parsed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Индексы для быстрого поиска
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_payments_branch ON payments(branch_code);
CREATE INDEX IF NOT EXISTS idx_payments_employee ON payments(employee_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_rentprog_id ON payments(rentprog_payment_id);

-- Уникальный constraint для дедупликации
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_dedup 
  ON payments(branch_code, rentprog_payment_id) 
  WHERE rentprog_payment_id IS NOT NULL;

-- Комментарии к таблице
COMMENT ON TABLE payments IS 'Центральная таблица всех платежей компании из кассы RentProg';
COMMENT ON COLUMN payments.payment_type IS 'Тип: приход (income), расход (expense), перевод (transfer)';
COMMENT ON COLUMN payments.payment_method IS 'Метод: наличные, карта, банк, прочее';
COMMENT ON COLUMN payments.raw_data IS 'Полные данные из RentProg UI для отладки';

