-- Миграция 0033: Создание таблицы city_delivery_pricing (тарифы доставки)
-- Дата: 2025-01-XX
-- Описание: Таблица для хранения тарифов доставки между филиалами и городами

DO $$ BEGIN
  CREATE TYPE delivery_scope AS ENUM ('city', 'airport', 'intercity');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE delivery_direction AS ENUM ('issue_only', 'return_only', 'both');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS city_delivery_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Связи
  city_id UUID REFERENCES cities(id),
  city_name TEXT, -- Денормализация для быстрого чтения
  
  -- Филиал доставки
  delivery_branch_id UUID REFERENCES branches(id),
  delivery_branch_code TEXT,
  
  -- Тип доставки
  delivery_scope delivery_scope NOT NULL DEFAULT 'intercity',
  
  -- Направление доставки
  delivery_direction delivery_direction NOT NULL DEFAULT 'both',
  
  -- Тарифы доставки (USD)
  in_city_fee_usd NUMERIC(10, 2) DEFAULT 10.00, -- Доставка внутри города
  airport_fee_usd NUMERIC(10, 2) DEFAULT 20.00, -- Доставка до аэропорта
  intercity_fee_usd NUMERIC(10, 2) NOT NULL, -- Доставка между городами (из routes.xlsx)
  
  -- Возврат (обычно равен intercity_fee_usd, но может отличаться)
  return_fee_usd NUMERIC(10, 2),
  
  -- Односторонняя аренда
  one_way_allowed BOOLEAN DEFAULT TRUE,
  
  -- Время доставки
  eta_hours INTEGER, -- Среднее время доставки в часах
  
  -- Минимальный срок аренды для предложения доставки
  min_rental_days INTEGER DEFAULT 3,
  
  -- Дополнительные условия
  notes TEXT,
  
  -- Метаданные
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Уникальность: один тариф на комбинацию город-филиал-тип
  CONSTRAINT city_delivery_pricing_unique UNIQUE(city_id, delivery_branch_id, delivery_scope)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_city_delivery_city ON city_delivery_pricing(city_id);
CREATE INDEX IF NOT EXISTS idx_city_delivery_branch ON city_delivery_pricing(delivery_branch_id);
CREATE INDEX IF NOT EXISTS idx_city_delivery_scope ON city_delivery_pricing(delivery_scope);
CREATE INDEX IF NOT EXISTS idx_city_delivery_active ON city_delivery_pricing(is_active) WHERE is_active = TRUE;

-- Комментарии
COMMENT ON TABLE city_delivery_pricing IS 'Тарифы доставки авто между филиалами и городами';
COMMENT ON COLUMN city_delivery_pricing.delivery_scope IS 'Тип доставки: city (внутри города), airport (до аэропорта), intercity (между городами)';
COMMENT ON COLUMN city_delivery_pricing.in_city_fee_usd IS 'Стоимость доставки внутри города: 10$';
COMMENT ON COLUMN city_delivery_pricing.airport_fee_usd IS 'Стоимость доставки до аэропорта: 20$';
COMMENT ON COLUMN city_delivery_pricing.intercity_fee_usd IS 'Стоимость доставки между городами (из routes.xlsx)';
COMMENT ON COLUMN city_delivery_pricing.return_fee_usd IS 'Стоимость возврата (по умолчанию = intercity_fee_usd)';

