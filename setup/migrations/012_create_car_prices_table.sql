-- =====================================================
-- Таблица цен автомобилей из RentProg
-- =====================================================
-- Дата: 2025-01-17
-- Описание: Цены на аренду по сезонам и периодам

CREATE TABLE IF NOT EXISTS car_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Связь с автомобилем
  car_id UUID REFERENCES cars(id) ON DELETE CASCADE,
  
  -- RentProg IDs
  rentprog_price_id TEXT,
  season_id INTEGER,
  
  -- Сезон (период действия цен)
  season_start_date DATE,
  season_end_date DATE,
  season_name TEXT,
  
  -- Цены (JSONB структура)
  price_values JSONB NOT NULL,
  -- Структура price_values:
  -- {
  --   "periods": ["1-3 дня", "4-7 дней", "8-15 дней", "16-30 дней", "31+ дней"],
  --   "values": [100, 90, 80, 70, 60],
  --   "items": [
  --     {"period": "1-3 дня", "price_per_day": 100, "price_gel": 100, "price_usd": 37, "currency": "GEL"},
  --     ...
  --   ],
  --   "currency": "GEL",
  --   "exchange_rate": 2.7
  -- }
  
  -- Метаданные
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Уникальность: один price record для car+season
  CONSTRAINT car_prices_car_season_unique UNIQUE (car_id, season_id)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_car_prices_car_id ON car_prices(car_id);
CREATE INDEX IF NOT EXISTS idx_car_prices_season ON car_prices(season_id);
CREATE INDEX IF NOT EXISTS idx_car_prices_active ON car_prices(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_car_prices_season_dates ON car_prices(season_start_date, season_end_date);
CREATE INDEX IF NOT EXISTS idx_car_prices_values_gin ON car_prices USING GIN (price_values);

-- Комментарии
COMMENT ON TABLE car_prices IS 'Цены на аренду автомобилей по сезонам и периодам (из RentProg API)';
COMMENT ON COLUMN car_prices.price_values IS 'JSONB структура с ценами по периодам аренды';
COMMENT ON COLUMN car_prices.season_id IS 'ID сезона в RentProg';
COMMENT ON COLUMN car_prices.rentprog_price_id IS 'ID price record в RentProg API';

-- =====================================================
-- View для удобного запроса текущих цен
-- =====================================================

CREATE OR REPLACE VIEW current_car_prices AS
SELECT 
  c.id as car_id,
  c.plate,
  c.model,
  cp.season_name,
  cp.season_start_date,
  cp.season_end_date,
  cp.price_values,
  -- Извлечь min/max цены
  (
    SELECT MIN((jsonb_array_elements(cp.price_values->'items')->>'price_per_day')::numeric)
    FROM jsonb_array_elements(cp.price_values->'items')
  ) as min_price_per_day,
  (
    SELECT MAX((jsonb_array_elements(cp.price_values->'items')->>'price_per_day')::numeric)
    FROM jsonb_array_elements(cp.price_values->'items')
  ) as max_price_per_day,
  cp.price_values->>'currency' as currency,
  cp.updated_at
FROM cars c
INNER JOIN car_prices cp ON c.id = cp.car_id
WHERE cp.active = TRUE
  AND (
    cp.season_start_date IS NULL OR cp.season_start_date <= CURRENT_DATE
  )
  AND (
    cp.season_end_date IS NULL OR cp.season_end_date >= CURRENT_DATE
  );

COMMENT ON VIEW current_car_prices IS 'Текущие действующие цены автомобилей (активные сезоны)';

-- =====================================================
-- Функция для получения цены за определённый период
-- =====================================================

CREATE OR REPLACE FUNCTION get_car_price_for_days(
  p_car_id UUID,
  p_days INTEGER,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS NUMERIC AS $$
DECLARE
  v_price_values JSONB;
  v_periods JSONB;
  v_values JSONB;
  v_period_index INTEGER;
  v_result NUMERIC;
BEGIN
  -- Получить price_values для указанной даты
  SELECT price_values INTO v_price_values
  FROM car_prices
  WHERE car_id = p_car_id
    AND active = TRUE
    AND (season_start_date IS NULL OR season_start_date <= p_date)
    AND (season_end_date IS NULL OR season_end_date >= p_date)
  LIMIT 1;
  
  IF v_price_values IS NULL THEN
    RETURN NULL;
  END IF;
  
  v_periods := v_price_values->'periods';
  v_values := v_price_values->'values';
  
  -- Определить индекс по количеству дней
  IF p_days <= 3 THEN
    v_period_index := 0;
  ELSIF p_days <= 7 THEN
    v_period_index := 1;
  ELSIF p_days <= 15 THEN
    v_period_index := 2;
  ELSIF p_days <= 30 THEN
    v_period_index := 3;
  ELSE
    v_period_index := 4;
  END IF;
  
  -- Извлечь цену
  v_result := (v_values->v_period_index)::text::numeric;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_car_price_for_days IS 'Получить цену за день для автомобиля и количества дней аренды';

-- =====================================================
-- Примеры использования
-- =====================================================

-- Текущие цены всех автомобилей
-- SELECT * FROM current_car_prices;

-- Получить цену для аренды 5 дней
-- SELECT get_car_price_for_days('car-uuid', 5);

-- Все цены автомобиля
-- SELECT * FROM car_prices WHERE car_id = 'car-uuid' ORDER BY season_start_date;

-- Статистика по ценам
-- SELECT 
--   COUNT(DISTINCT car_id) as cars_with_prices,
--   COUNT(*) as total_price_records,
--   AVG((price_values->'values'->0)::text::numeric) as avg_min_price
-- FROM car_prices
-- WHERE active = TRUE;

