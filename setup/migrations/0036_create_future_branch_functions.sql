-- Миграция 0036: Функции для автоматического определения и обновления future_branch_id
-- Дата: 2025-01-XX
-- Описание: Функции для расчёта будущего филиала на основе броней

-- Функция для определения филиала по городу возврата брони
CREATE OR REPLACE FUNCTION get_branch_by_city(city_name TEXT)
RETURNS UUID AS $$
DECLARE
  branch_id UUID;
BEGIN
  -- Сначала ищем город с primary_branch_id
  SELECT primary_branch_id INTO branch_id
  FROM cities
  WHERE LOWER(name) = LOWER(city_name)
    AND primary_branch_id IS NOT NULL
    AND is_active = TRUE
  LIMIT 1;
  
  -- Если не нашли, ищем через nearest_branch_id
  IF branch_id IS NULL THEN
    SELECT nearest_branch_id INTO branch_id
    FROM cities
    WHERE LOWER(name) = LOWER(city_name)
      AND nearest_branch_id IS NOT NULL
      AND is_active = TRUE
    LIMIT 1;
  END IF;
  
  RETURN branch_id;
END;
$$ LANGUAGE plpgsql;

-- Функция для определения филиала по коду филиала из брони
CREATE OR REPLACE FUNCTION get_branch_by_code(branch_code TEXT)
RETURNS UUID AS $$
DECLARE
  branch_id UUID;
BEGIN
  SELECT id INTO branch_id
  FROM branches
  WHERE code = branch_code
  LIMIT 1;
  
  RETURN branch_id;
END;
$$ LANGUAGE plpgsql;

-- Функция для обновления future_branch_id для конкретной машины
CREATE OR REPLACE FUNCTION update_car_future_branch(p_car_id UUID)
RETURNS VOID AS $$
DECLARE
  v_future_booking bookings%ROWTYPE;
  v_future_branch_id UUID;
  v_future_branch_code TEXT;
  v_days_until INTEGER;
  v_return_city TEXT;
  v_return_location TEXT;
BEGIN
  -- Находим ближайшую будущую бронь
  SELECT * INTO v_future_booking
  FROM bookings
  WHERE car_id = p_car_id
    AND start_at >= NOW()
    AND status NOT IN ('cancelled', 'rejected', 'deleted')
  ORDER BY start_at ASC
  LIMIT 1;
  
  -- Если бронь найдена
  IF v_future_booking.id IS NOT NULL THEN
    -- Определяем город возврата из данных брони
    -- Сначала пробуем из return_location (если есть в JSONB data)
    v_return_location := v_future_booking.data->>'return_location';
    v_return_city := v_future_booking.data->>'return_city';
    
    -- Если есть branch_id в брони, используем его
    IF v_future_booking.branch_id IS NOT NULL THEN
      v_future_branch_id := v_future_booking.branch_id;
      SELECT code INTO v_future_branch_code FROM branches WHERE id = v_future_branch_id;
    -- Иначе пытаемся определить по городу
    ELSIF v_return_city IS NOT NULL THEN
      v_future_branch_id := get_branch_by_city(v_return_city);
      IF v_future_branch_id IS NOT NULL THEN
        SELECT code INTO v_future_branch_code FROM branches WHERE id = v_future_branch_id;
      END IF;
    END IF;
    
    -- Рассчитываем количество дней до брони
    v_days_until := EXTRACT(DAY FROM (v_future_booking.start_at - NOW()))::INTEGER;
    
    -- Обновляем или создаём запись в car_branch_states
    INSERT INTO car_branch_states (
      car_id,
      future_branch_id,
      future_branch_code,
      future_booking_id,
      future_booking_start_at,
      future_booking_end_at,
      days_until_future_booking,
      last_calculated_at,
      updated_at
    ) VALUES (
      p_car_id,
      v_future_branch_id,
      v_future_branch_code,
      v_future_booking.id,
      v_future_booking.start_at,
      v_future_booking.end_at,
      v_days_until,
      NOW(),
      NOW()
    )
    ON CONFLICT (car_id) DO UPDATE SET
      future_branch_id = EXCLUDED.future_branch_id,
      future_branch_code = EXCLUDED.future_branch_code,
      future_booking_id = EXCLUDED.future_booking_id,
      future_booking_start_at = EXCLUDED.future_booking_start_at,
      future_booking_end_at = EXCLUDED.future_booking_end_at,
      days_until_future_booking = EXCLUDED.days_until_future_booking,
      last_calculated_at = NOW(),
      updated_at = NOW();
  ELSE
    -- Если брони нет, очищаем future_branch
    UPDATE car_branch_states
    SET
      future_branch_id = NULL,
      future_branch_code = NULL,
      future_booking_id = NULL,
      future_booking_start_at = NULL,
      future_booking_end_at = NULL,
      days_until_future_booking = NULL,
      last_calculated_at = NOW(),
      updated_at = NOW()
    WHERE car_id = p_car_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Функция для автоматического обновления desired_branch_id
CREATE OR REPLACE FUNCTION update_car_desired_branch(p_car_id UUID)
RETURNS VOID AS $$
DECLARE
  v_car_state car_branch_states%ROWTYPE;
  v_desired_branch_id UUID;
  v_desired_reason TEXT;
BEGIN
  -- Получаем текущее состояние машины
  SELECT * INTO v_car_state
  FROM car_branch_states
  WHERE car_id = p_car_id;
  
  -- Если машины нет в car_branch_states, создаём запись
  IF v_car_state.id IS NULL THEN
    INSERT INTO car_branch_states (car_id)
    VALUES (p_car_id)
    RETURNING * INTO v_car_state;
  END IF;
  
  -- Правило 1: Если до будущей брони <= 7 дней, desired = future_branch
  IF v_car_state.days_until_future_booking IS NOT NULL 
     AND v_car_state.days_until_future_booking <= 7 
     AND v_car_state.future_branch_id IS NOT NULL THEN
    v_desired_branch_id := v_car_state.future_branch_id;
    v_desired_reason := 'auto_future_branch';
  -- Правило 2: Если есть home_branch, он всегда желаемый
  ELSIF v_car_state.home_branch_id IS NOT NULL THEN
    v_desired_branch_id := v_car_state.home_branch_id;
    v_desired_reason := 'home_branch';
  END IF;
  
  -- Обновляем desired_branch только если он изменился или не был установлен
  IF v_desired_branch_id IS NOT NULL 
     AND (v_car_state.desired_branch_id IS NULL OR v_car_state.desired_branch_id != v_desired_branch_id) THEN
    UPDATE car_branch_states
    SET
      desired_branch_id = v_desired_branch_id,
      desired_branch_code = (SELECT code FROM branches WHERE id = v_desired_branch_id),
      desired_reason = v_desired_reason,
      desired_set_at = NOW(),
      updated_at = NOW()
    WHERE car_id = p_car_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Функция для полного обновления состояния машины (future + desired)
CREATE OR REPLACE FUNCTION refresh_car_branch_state(p_car_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Обновляем future_branch
  PERFORM update_car_future_branch(p_car_id);
  
  -- Обновляем desired_branch
  PERFORM update_car_desired_branch(p_car_id);
END;
$$ LANGUAGE plpgsql;

-- Комментарии
COMMENT ON FUNCTION get_branch_by_city IS 'Определяет филиал по названию города';
COMMENT ON FUNCTION get_branch_by_code IS 'Определяет филиал по коду';
COMMENT ON FUNCTION update_car_future_branch IS 'Обновляет future_branch_id для машины на основе ближайшей будущей брони';
COMMENT ON FUNCTION update_car_desired_branch IS 'Автоматически обновляет desired_branch_id по правилам';
COMMENT ON FUNCTION refresh_car_branch_state IS 'Полное обновление состояния машины (future + desired)';

