-- Таблица для хранения курсов валют из RentProg
CREATE TABLE IF NOT EXISTS exchange_rates (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  branch TEXT NOT NULL,
  
  -- Курсы валют к базовой валюте (GEL)
  gel_to_rub DECIMAL(10, 6),
  gel_to_usd DECIMAL(10, 6),
  gel_to_eur DECIMAL(10, 6),
  
  -- Обратные курсы (для удобства)
  usd_to_gel DECIMAL(10, 6),
  eur_to_gel DECIMAL(10, 6),
  rub_to_gel DECIMAL(10, 6),
  
  -- Сырые данные от RentProg
  raw_data JSONB
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_exchange_rates_branch 
  ON exchange_rates(branch);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_ts 
  ON exchange_rates(ts DESC);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_branch_ts 
  ON exchange_rates(branch, ts DESC);

-- Комментарии
COMMENT ON TABLE exchange_rates IS 'Курсы валют из RentProg (парсятся с /company_profile)';
COMMENT ON COLUMN exchange_rates.branch IS 'Филиал (tbilisi, batumi, kutaisi, service-center)';
COMMENT ON COLUMN exchange_rates.gel_to_rub IS 'Курс GEL → RUB';
COMMENT ON COLUMN exchange_rates.gel_to_usd IS 'Курс GEL → USD (обычно ~0.37)';
COMMENT ON COLUMN exchange_rates.gel_to_eur IS 'Курс GEL → EUR';
COMMENT ON COLUMN exchange_rates.raw_data IS 'Полные данные с RentProg (все курсы и направления)';

