-- Миграция 0039: Функция для расчёта доплаты за нерабочее время
-- Дата: 2025-01-XX
-- Описание: Функция для определения, нужно ли взимать доплату за выдачу/приём вне рабочего времени

-- Функция для проверки, является ли время нерабочим
-- Рабочее время: 09:00 - 20:00 (Asia/Tbilisi)
CREATE OR REPLACE FUNCTION is_out_of_hours(check_time TIMESTAMPTZ)
RETURNS BOOLEAN AS $$
DECLARE
  local_time TIME;
  hour_value INTEGER;
BEGIN
  -- Конвертируем в локальное время Tbilisi (UTC+4)
  local_time := (check_time AT TIME ZONE 'Asia/Tbilisi')::TIME;
  hour_value := EXTRACT(HOUR FROM local_time)::INTEGER;
  
  -- Нерабочее время: до 09:00 или после 20:00
  RETURN hour_value < 9 OR hour_value >= 20;
END;
$$ LANGUAGE plpgsql;

-- Функция для расчёта доплаты за нерабочее время
-- Принимает время выдачи и время возврата
CREATE OR REPLACE FUNCTION calculate_out_of_hours_fee(
  issue_time TIMESTAMPTZ,
  return_time TIMESTAMPTZ,
  fee_per_operation NUMERIC DEFAULT 20.00
)
RETURNS NUMERIC AS $$
DECLARE
  total_fee NUMERIC := 0.00;
BEGIN
  -- Проверяем выдачу
  IF issue_time IS NOT NULL AND is_out_of_hours(issue_time) THEN
    total_fee := total_fee + fee_per_operation;
  END IF;
  
  -- Проверяем возврат
  IF return_time IS NOT NULL AND is_out_of_hours(return_time) THEN
    total_fee := total_fee + fee_per_operation;
  END IF;
  
  RETURN total_fee;
END;
$$ LANGUAGE plpgsql;

-- Комментарии
COMMENT ON FUNCTION is_out_of_hours IS 'Проверяет, является ли время нерабочим (до 09:00 или после 20:00 по Asia/Tbilisi)';
COMMENT ON FUNCTION calculate_out_of_hours_fee IS 'Рассчитывает доплату за нерабочее время для выдачи и возврата (20$ за каждую операцию)';

