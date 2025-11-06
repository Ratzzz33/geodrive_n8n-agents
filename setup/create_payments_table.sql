-- Создание таблицы payments для хранения платежей из RentProg
-- Дата создания: 2025-11-07

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  booking_id UUID REFERENCES bookings(id),
  employee_id UUID REFERENCES employees(id),
  payment_date TIMESTAMPTZ NOT NULL,
  payment_type TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  amount TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GEL',
  description TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS payments_branch_idx ON payments(branch_id);
CREATE INDEX IF NOT EXISTS payments_booking_idx ON payments(booking_id);
CREATE INDEX IF NOT EXISTS payments_employee_idx ON payments(employee_id);
CREATE INDEX IF NOT EXISTS payments_date_idx ON payments(payment_date);
CREATE INDEX IF NOT EXISTS payments_type_idx ON payments(payment_type);

-- Комментарии
COMMENT ON TABLE payments IS 'Платежи и кассовые операции из RentProg';
COMMENT ON COLUMN payments.payment_type IS 'Группа платежа (расходы на топливо, зарплата, и т.д.)';
COMMENT ON COLUMN payments.payment_method IS 'Метод оплаты: cash, cashless, card';
COMMENT ON COLUMN payments.amount IS 'Сумма платежа (numeric as text для точности)';
COMMENT ON COLUMN payments.raw_data IS 'Полные данные из RentProg API';

