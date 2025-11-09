-- Таблица для хранения курсов валют из RentProg

CREATE TABLE IF NOT EXISTS exchange_rates (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  branch TEXT NOT NULL,
  
  -- Курсы GEL -> другие валюты
  gel_to_rub NUMERIC(10, 4),
  gel_to_usd NUMERIC(10, 4),
  gel_to_eur NUMERIC(10, 4),
  
  -- Обратные курсы
  rub_to_gel NUMERIC(10, 4),
  usd_to_gel NUMERIC(10, 4),
  eur_to_gel NUMERIC(10, 4),
  
  -- Сырые данные
  raw_data JSONB
);

-- Индекс для быстрого поиска по филиалу
CREATE INDEX IF NOT EXISTS idx_exchange_rates_branch ON exchange_rates(branch);

-- Индекс для поиска последних курсов
CREATE INDEX IF NOT EXISTS idx_exchange_rates_created_at ON exchange_rates(created_at DESC);

-- Комментарии
COMMENT ON TABLE exchange_rates IS 'Курсы валют из RentProg (парсинг через Playwright)';
COMMENT ON COLUMN exchange_rates.branch IS 'Филиал (tbilisi/batumi/kutaisi/service-center)';
COMMENT ON COLUMN exchange_rates.gel_to_rub IS 'Курс GEL -> RUB';
COMMENT ON COLUMN exchange_rates.gel_to_usd IS 'Курс GEL -> USD';
COMMENT ON COLUMN exchange_rates.gel_to_eur IS 'Курс GEL -> EUR';
COMMENT ON COLUMN exchange_rates.rub_to_gel IS 'Курс RUB -> GEL';
COMMENT ON COLUMN exchange_rates.usd_to_gel IS 'Курс USD -> GEL';
COMMENT ON COLUMN exchange_rates.eur_to_gel IS 'Курс EUR -> GEL';
COMMENT ON COLUMN exchange_rates.raw_data IS 'Сырые данные парсинга';

