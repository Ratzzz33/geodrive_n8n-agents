-- Миграция 0034: Создание таблицы car_branch_states (статусы филиалов для машин)
-- Дата: 2025-01-XX
-- Описание: Таблица для отслеживания текущего, будущего, желаемого и родного филиала каждой машины

CREATE TABLE IF NOT EXISTS car_branch_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Связь с машиной
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  
  -- Текущий филиал (где машина находится сейчас)
  current_branch_id UUID REFERENCES branches(id),
  current_branch_code TEXT,
  
  -- Будущий филиал (куда машина должна вернуться по ближайшей брони)
  future_branch_id UUID REFERENCES branches(id),
  future_branch_code TEXT,
  future_booking_id UUID REFERENCES bookings(id),
  future_booking_start_at TIMESTAMPTZ,
  future_booking_end_at TIMESTAMPTZ,
  days_until_future_booking INTEGER, -- Количество дней до следующей брони
  
  -- Желаемый филиал (куда хотим перегнать машину)
  desired_branch_id UUID REFERENCES branches(id),
  desired_branch_code TEXT,
  desired_reason TEXT, -- Причина: 'service', 'manual', 'auto_future_branch', 'home_branch'
  desired_set_at TIMESTAMPTZ, -- Когда был установлен желаемый филиал
  
  -- Родной филиал (для машин, которые должны работать в конкретном филиале)
  home_branch_id UUID REFERENCES branches(id),
  home_branch_code TEXT,
  
  -- Метаданные
  last_calculated_at TIMESTAMPTZ, -- Когда последний раз пересчитывался future_branch
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Одна запись на машину
  CONSTRAINT car_branch_states_car_unique UNIQUE(car_id)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_car_branch_states_car ON car_branch_states(car_id);
CREATE INDEX IF NOT EXISTS idx_car_branch_states_current ON car_branch_states(current_branch_id);
CREATE INDEX IF NOT EXISTS idx_car_branch_states_future ON car_branch_states(future_branch_id);
CREATE INDEX IF NOT EXISTS idx_car_branch_states_desired ON car_branch_states(desired_branch_id);
CREATE INDEX IF NOT EXISTS idx_car_branch_states_home ON car_branch_states(home_branch_id);
CREATE INDEX IF NOT EXISTS idx_car_branch_states_future_booking ON car_branch_states(future_booking_id);
CREATE INDEX IF NOT EXISTS idx_car_branch_states_days_until ON car_branch_states(days_until_future_booking);

-- Комментарии
COMMENT ON TABLE car_branch_states IS 'Статусы филиалов для каждой машины: текущий, будущий, желаемый, родной';
COMMENT ON COLUMN car_branch_states.current_branch_id IS 'Филиал, где машина находится сейчас';
COMMENT ON COLUMN car_branch_states.future_branch_id IS 'Филиал, куда машина должна вернуться по ближайшей будущей брони';
COMMENT ON COLUMN car_branch_states.desired_branch_id IS 'Филиал, куда хотим перегнать машину (вручную или автоматически)';
COMMENT ON COLUMN car_branch_states.home_branch_id IS 'Родной филиал машины (если установлен)';
COMMENT ON COLUMN car_branch_states.days_until_future_booking IS 'Количество дней до следующей брони (для расчёта скидок)';
COMMENT ON COLUMN car_branch_states.desired_reason IS 'Причина установки желаемого филиала: service, manual, auto_future_branch, home_branch';

