-- Миграция 0035: Создание таблицы one_way_discount_rules (правила скидок на одностороннюю аренду)
-- Дата: 2025-01-XX
-- Описание: Таблица для хранения правил скидок на одностороннюю аренду

DO $$ BEGIN
  CREATE TYPE discount_condition_type AS ENUM (
    'home_branch',           -- Возврат в родной филиал
    'desired_branch',        -- Возврат в желаемый филиал
    'future_booking_window'  -- Окно до следующей брони (7-14 дней или <7 дней)
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS one_way_discount_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Приоритет применения (меньше = выше приоритет)
  priority INTEGER NOT NULL DEFAULT 100,
  
  -- Тип условия
  condition_type discount_condition_type NOT NULL,
  
  -- Окно дней до следующей брони (для future_booking_window)
  window_days_min INTEGER, -- Минимальное количество дней (включительно)
  window_days_max INTEGER, -- Максимальное количество дней (включительно)
  
  -- Размер скидки (0-100 процентов)
  discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  
  -- Автоматическое применение
  auto_apply BOOLEAN DEFAULT TRUE,
  
  -- Описание правила
  description TEXT,
  notes TEXT,
  
  -- Метаданные
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_discount_rules_priority ON one_way_discount_rules(priority);
CREATE INDEX IF NOT EXISTS idx_discount_rules_condition ON one_way_discount_rules(condition_type);
CREATE INDEX IF NOT EXISTS idx_discount_rules_active ON one_way_discount_rules(is_active) WHERE is_active = TRUE;

-- Комментарии
COMMENT ON TABLE one_way_discount_rules IS 'Правила скидок на одностороннюю аренду';
COMMENT ON COLUMN one_way_discount_rules.priority IS 'Приоритет применения правила (меньше = выше приоритет)';
COMMENT ON COLUMN one_way_discount_rules.condition_type IS 'Тип условия: home_branch, desired_branch, future_booking_window';
COMMENT ON COLUMN one_way_discount_rules.window_days_min IS 'Минимальное количество дней до следующей брони (для future_booking_window)';
COMMENT ON COLUMN one_way_discount_rules.window_days_max IS 'Максимальное количество дней до следующей брони (для future_booking_window)';
COMMENT ON COLUMN one_way_discount_rules.discount_percent IS 'Размер скидки в процентах (0-100)';

-- Вставка стандартных правил
INSERT INTO one_way_discount_rules (priority, condition_type, discount_percent, description, auto_apply) VALUES
  (10, 'home_branch', 100.00, 'Бесплатная односторонняя аренда при возврате в родной филиал', TRUE),
  (20, 'desired_branch', 100.00, 'Бесплатная односторонняя аренда при возврате в желаемый филиал', TRUE),
  (30, 'future_booking_window', 50.00, 'Скидка 50% при возврате за 7-14 дней до следующей брони', TRUE),
  (40, 'future_booking_window', 100.00, 'Бесплатная односторонняя аренда при возврате менее чем за 7 дней до следующей брони', TRUE)
ON CONFLICT DO NOTHING;

