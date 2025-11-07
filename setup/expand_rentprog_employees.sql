-- Добавляем недостающие поля для разноски data в rentprog_employees

-- Email и роль
ALTER TABLE rentprog_employees 
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- Данные аккаунта
ALTER TABLE rentprog_employees
  ADD COLUMN IF NOT EXISTS account_cash NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS account_id INTEGER;

-- Кассовые счета по валютам
ALTER TABLE rentprog_employees
  ADD COLUMN IF NOT EXISTS cash_gel NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS cash_usd NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS cash_eur NUMERIC(10, 2);

-- Traccar данные
ALTER TABLE rentprog_employees
  ADD COLUMN IF NOT EXISTS traccar_id INTEGER,
  ADD COLUMN IF NOT EXISTS traccar_password TEXT;

-- Голосование
ALTER TABLE rentprog_employees
  ADD COLUMN IF NOT EXISTS vote_up INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vote_down INTEGER DEFAULT 0;

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_rentprog_employees_email ON rentprog_employees(email);
CREATE INDEX IF NOT EXISTS idx_rentprog_employees_role ON rentprog_employees(role);
CREATE INDEX IF NOT EXISTS idx_rentprog_employees_active ON rentprog_employees(active);

COMMENT ON COLUMN rentprog_employees.email IS 'Email сотрудника из RentProg';
COMMENT ON COLUMN rentprog_employees.role IS 'Роль: superadmin, manager, user, partner';
COMMENT ON COLUMN rentprog_employees.active IS 'Активен ли сотрудник';
COMMENT ON COLUMN rentprog_employees.account_cash IS 'Баланс основного счета';
COMMENT ON COLUMN rentprog_employees.cash_gel IS 'Баланс в кассе GEL';
COMMENT ON COLUMN rentprog_employees.cash_usd IS 'Баланс в кассе USD';
COMMENT ON COLUMN rentprog_employees.cash_eur IS 'Баланс в кассе EUR';

