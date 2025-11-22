-- Миграция 0038: Создание VIEW для удобного доступа агента к данным о доставке
-- Дата: 2025-01-XX
-- Описание: Представление для расчёта стоимости доставки с учётом всех правил и скидок

CREATE OR REPLACE VIEW car_delivery_options_view AS
SELECT
  -- Основные данные о машине
  c.id AS car_id,
  c.plate AS car_plate,
  c.model AS car_model,
  
  -- Статусы филиалов
  cbs.current_branch_id,
  cbs.current_branch_code,
  cbs.future_branch_id,
  cbs.future_branch_code,
  cbs.desired_branch_id,
  cbs.desired_branch_code,
  cbs.home_branch_id,
  cbs.home_branch_code,
  cbs.days_until_future_booking,
  
  -- Данные о доставке
  cdp.id AS delivery_pricing_id,
  cdp.city_id,
  cdp.city_name,
  cdp.delivery_branch_id AS target_branch_id,
  cdp.delivery_branch_code AS target_branch_code,
  cdp.delivery_scope,
  cdp.delivery_direction,
  
  -- Тарифы
  CASE 
    WHEN cdp.delivery_scope = 'city' THEN cdp.in_city_fee_usd
    WHEN cdp.delivery_scope = 'airport' THEN cdp.airport_fee_usd
    ELSE cdp.intercity_fee_usd
  END AS delivery_base_fee_usd,
  
  cdp.intercity_fee_usd,
  cdp.return_fee_usd,
  cdp.one_way_allowed,
  cdp.eta_hours,
  cdp.min_rental_days,
  
  -- Применение скидок на одностороннюю аренду
  CASE
    -- Правило 1: Возврат в родной филиал - 100% скидка
    WHEN cbs.home_branch_id IS NOT NULL 
         AND cdp.delivery_branch_id = cbs.home_branch_id THEN 100.00
    -- Правило 2: Возврат в желаемый филиал - 100% скидка
    WHEN cbs.desired_branch_id IS NOT NULL 
         AND cdp.delivery_branch_id = cbs.desired_branch_id THEN 100.00
    -- Правило 3: 7-14 дней до следующей брони - 50% скидка
    WHEN cbs.days_until_future_booking IS NOT NULL 
         AND cbs.days_until_future_booking >= 7 
         AND cbs.days_until_future_booking <= 14 THEN 50.00
    -- Правило 4: Менее 7 дней до следующей брони - 100% скидка
    WHEN cbs.days_until_future_booking IS NOT NULL 
         AND cbs.days_until_future_booking < 7 THEN 100.00
    -- Нет скидки
    ELSE 0.00
  END AS discount_percent,
  
  -- Финальная стоимость возврата с учётом скидки
  CASE
    WHEN cdp.return_fee_usd IS NOT NULL THEN
      cdp.return_fee_usd * (1 - 
        CASE
          WHEN cbs.home_branch_id IS NOT NULL 
               AND cdp.delivery_branch_id = cbs.home_branch_id THEN 1.00
          WHEN cbs.desired_branch_id IS NOT NULL 
               AND cdp.delivery_branch_id = cbs.desired_branch_id THEN 1.00
          WHEN cbs.days_until_future_booking IS NOT NULL 
               AND cbs.days_until_future_booking >= 7 
               AND cbs.days_until_future_booking <= 14 THEN 0.50
          WHEN cbs.days_until_future_booking IS NOT NULL 
               AND cbs.days_until_future_booking < 7 THEN 1.00
          ELSE 0.00
        END
      )
    ELSE NULL
  END AS final_one_way_fee_usd,
  
  -- Финальная стоимость доставки
  CASE 
    WHEN cdp.delivery_scope = 'city' THEN cdp.in_city_fee_usd
    WHEN cdp.delivery_scope = 'airport' THEN cdp.airport_fee_usd
    ELSE cdp.intercity_fee_usd
  END AS final_delivery_fee_usd,
  
  -- Доплата за нерабочее время (будет рассчитываться в коде на основе времени выдачи/возврата)
  -- Здесь просто указываем размер доплаты
  20.00 AS out_of_hours_fee_usd,
  
  -- Флаг: можно ли предложить без доплаты за возврат
  CASE
    WHEN cbs.home_branch_id IS NOT NULL 
         AND cdp.delivery_branch_id = cbs.home_branch_id THEN TRUE
    WHEN cbs.desired_branch_id IS NOT NULL 
         AND cdp.delivery_branch_id = cbs.desired_branch_id THEN TRUE
    WHEN cbs.days_until_future_booking IS NOT NULL 
         AND cbs.days_until_future_booking < 7 THEN TRUE
    ELSE FALSE
  END AS can_offer_without_fee,
  
  -- Метаданные
  cbs.last_calculated_at,
  cdp.updated_at AS pricing_updated_at
  
FROM cars c
LEFT JOIN car_branch_states cbs ON c.id = cbs.car_id
LEFT JOIN city_delivery_pricing cdp ON cdp.is_active = TRUE
WHERE c.id IS NOT NULL;

-- Комментарии
COMMENT ON VIEW car_delivery_options_view IS 'Представление для расчёта стоимости доставки авто с учётом всех правил и скидок';
COMMENT ON COLUMN car_delivery_options_view.discount_percent IS 'Применённая скидка в процентах (0-100)';
COMMENT ON COLUMN car_delivery_options_view.final_one_way_fee_usd IS 'Финальная стоимость возврата с учётом скидки';
COMMENT ON COLUMN car_delivery_options_view.final_delivery_fee_usd IS 'Финальная стоимость доставки';
COMMENT ON COLUMN car_delivery_options_view.out_of_hours_fee_usd IS 'Доплата за выдачу/приём вне рабочего времени (09:00-20:00)';
COMMENT ON COLUMN car_delivery_options_view.can_offer_without_fee IS 'Можно ли предложить одностороннюю аренду без доплаты за возврат';

