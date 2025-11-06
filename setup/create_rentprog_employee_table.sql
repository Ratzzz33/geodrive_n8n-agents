-- Таблица для хранения данных сотрудников из RentProg
CREATE TABLE IF NOT EXISTS rentprog_employee (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  branch TEXT,
  name TEXT,
  email TEXT,
  role TEXT,
  active BOOLEAN DEFAULT TRUE,
  last_activity TIMESTAMPTZ,
  cashbox_gel NUMERIC(10, 2),
  cashbox_usd NUMERIC(10, 2),
  cashbox_eur NUMERIC(10, 2),
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rentprog_employee_user_id ON rentprog_employee(user_id);
CREATE INDEX IF NOT EXISTS idx_rentprog_employee_branch ON rentprog_employee(branch);
CREATE INDEX IF NOT EXISTS idx_rentprog_employee_active ON rentprog_employee(active);

COMMENT ON TABLE rentprog_employee IS 'Кэш данных сотрудников из RentProg';
COMMENT ON COLUMN rentprog_employee.user_id IS 'ID пользователя в RentProg';
COMMENT ON COLUMN rentprog_employee.branch IS 'Филиал: tbilisi, batumi, kutaisi, service-center';
COMMENT ON COLUMN rentprog_employee.raw_data IS 'Полные данные из RentProg API';

