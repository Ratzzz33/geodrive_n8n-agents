-- Таблица для хранения данных сотрудников из RentProg
CREATE TABLE IF NOT EXISTS rentprog_employyes (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  branch TEXT NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT,
  active BOOLEAN DEFAULT TRUE,
  last_activity TIMESTAMPTZ,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rentprog_employyes_user_id ON rentprog_employyes(user_id);
CREATE INDEX IF NOT EXISTS idx_rentprog_employyes_branch ON rentprog_employyes(branch);
CREATE INDEX IF NOT EXISTS idx_rentprog_employyes_active ON rentprog_employyes(active);
CREATE INDEX IF NOT EXISTS idx_rentprog_employyes_email ON rentprog_employyes(email) WHERE email IS NOT NULL;

COMMENT ON TABLE rentprog_employyes IS 'Данные сотрудников из RentProg (импорт через API)';
COMMENT ON COLUMN rentprog_employyes.user_id IS 'ID пользователя в RentProg (уникальный)';
COMMENT ON COLUMN rentprog_employyes.branch IS 'Филиал: tbilisi, batumi, kutaisi, service-center';
COMMENT ON COLUMN rentprog_employyes.raw_data IS 'Полные данные из RentProg API';

