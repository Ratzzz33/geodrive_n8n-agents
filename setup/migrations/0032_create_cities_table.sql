-- Миграция 0032: Создание таблицы cities (города с привязкой к филиалам)
-- Дата: 2025-01-XX
-- Описание: Таблица для хранения популярных городов Грузии и их привязки к филиалам

CREATE TABLE IF NOT EXISTS cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Основные данные
  name TEXT NOT NULL,
  name_ge TEXT, -- Название на грузинском
  name_en TEXT, -- Название на английском
  
  -- Привязка к филиалу
  primary_branch_id UUID REFERENCES branches(id),
  primary_branch_code TEXT, -- Денормализация для быстрого доступа
  
  -- Ближайший филиал (если город не имеет своего филиала)
  nearest_branch_id UUID REFERENCES branches(id),
  nearest_branch_code TEXT,
  
  -- Географические данные
  latitude NUMERIC,
  longitude NUMERIC,
  
  -- Тип локации
  has_airport BOOLEAN DEFAULT FALSE,
  airport_name TEXT,
  
  -- Метаданные
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT cities_name_unique UNIQUE(name)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_cities_primary_branch ON cities(primary_branch_id);
CREATE INDEX IF NOT EXISTS idx_cities_nearest_branch ON cities(nearest_branch_id);
CREATE INDEX IF NOT EXISTS idx_cities_active ON cities(is_active) WHERE is_active = TRUE;

-- Комментарии
COMMENT ON TABLE cities IS 'Популярные города Грузии для доставки авто';
COMMENT ON COLUMN cities.primary_branch_id IS 'Основной филиал, к которому относится город';
COMMENT ON COLUMN cities.nearest_branch_id IS 'Ближайший филиал, если город не имеет своего филиала';
COMMENT ON COLUMN cities.has_airport IS 'Есть ли в городе аэропорт';

