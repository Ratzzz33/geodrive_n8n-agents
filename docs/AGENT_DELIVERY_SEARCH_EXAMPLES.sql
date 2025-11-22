-- Примеры SQL запросов для агента поиска авто с доставкой
-- Используй эти запросы как основу для своей реализации

-- ============================================================================
-- ПРИМЕР 1: Поиск свободных машин с учётом будущего филиала
-- ============================================================================

-- Параметры:
-- $1: issueDate (TIMESTAMPTZ) - дата выдачи
-- $2: returnDate (TIMESTAMPTZ) - дата возврата
-- $3: targetBranchCode (TEXT) - код целевого филиала ('tbilisi', 'batumi', 'kutaisi')
-- $4: targetCity (TEXT) - название города ('Тбилиси', 'Батуми', 'Кутаиси')

WITH available_cars AS (
  SELECT DISTINCT
    c.id AS car_id,
    c.plate,
    c.model,
    c.branch_id AS car_branch_id,
    b.code AS car_branch_code,
    
    -- Статусы филиалов
    cbs.current_branch_id,
    cbs.current_branch_code,
    cbs.future_branch_id,
    cbs.future_branch_code,
    cbs.home_branch_id,
    cbs.desired_branch_id,
    cbs.days_until_future_booking,
    cbs.future_booking_start_at,
    
    -- Эффективный филиал для поиска
    CASE
      -- Если есть будущая бронь, которая начинается до или в день выдачи
      WHEN cbs.future_booking_start_at IS NOT NULL 
           AND cbs.future_booking_start_at <= $1::TIMESTAMPTZ THEN
        cbs.future_branch_id
      -- Иначе используем текущий филиал
      ELSE COALESCE(cbs.current_branch_id, c.branch_id)
    END AS effective_branch_id,
    
    CASE
      WHEN cbs.future_booking_start_at IS NOT NULL 
           AND cbs.future_booking_start_at <= $1::TIMESTAMPTZ THEN
        cbs.future_branch_code
      ELSE COALESCE(cbs.current_branch_code, b.code)
    END AS effective_branch_code
    
  FROM cars c
  LEFT JOIN branches b ON c.branch_id = b.id
  LEFT JOIN car_branch_states cbs ON c.id = cbs.car_id
  WHERE c.available = TRUE
    -- Проверка доступности: нет пересекающихся броней
    AND NOT EXISTS (
      SELECT 1 FROM bookings bk
      WHERE bk.car_id = c.id
        AND bk.status NOT IN ('cancelled', 'rejected', 'deleted')
        AND (
          (bk.start_at <= $1::TIMESTAMPTZ AND bk.end_at >= $1::TIMESTAMPTZ) OR
          (bk.start_at <= $2::TIMESTAMPTZ AND bk.end_at >= $2::TIMESTAMPTZ) OR
          (bk.start_at >= $1::TIMESTAMPTZ AND bk.end_at <= $2::TIMESTAMPTZ)
        )
    )
),
target_branch AS (
  SELECT id, code FROM branches WHERE code = $3::TEXT
),
target_city AS (
  SELECT id, name FROM cities WHERE name = $4::TEXT
)
SELECT 
  ac.*,
  tb.id AS target_branch_id,
  tb.code AS target_branch_code,
  tc.id AS target_city_id,
  tc.name AS target_city_name,
  
  -- Флаг: машина в целевом филиале (без доставки)
  CASE WHEN ac.effective_branch_id = tb.id THEN TRUE ELSE FALSE END AS is_local,
  
  -- Данные о доставке (если нужна)
  cdp.id AS delivery_pricing_id,
  cdp.delivery_scope,
  CASE 
    WHEN ac.effective_branch_id = tb.id THEN 0.00
    WHEN cdp.delivery_scope = 'city' THEN cdp.in_city_fee_usd
    WHEN cdp.delivery_scope = 'airport' THEN cdp.airport_fee_usd
    ELSE cdp.intercity_fee_usd
  END AS delivery_fee_usd,
  
  -- Стоимость возврата с учётом скидки
  CASE
    -- Если возврат в home_branch - бесплатно
    WHEN ac.home_branch_id = tb.id THEN 0.00
    -- Если возврат в desired_branch - бесплатно
    WHEN ac.desired_branch_id = tb.id THEN 0.00
    -- Если до следующей брони <7 дней - бесплатно
    WHEN ac.days_until_future_booking IS NOT NULL 
         AND ac.days_until_future_booking < 7 THEN 0.00
    -- Если до следующей брони 7-14 дней - 50% скидка
    WHEN ac.days_until_future_booking IS NOT NULL 
         AND ac.days_until_future_booking >= 7 
         AND ac.days_until_future_booking <= 14 THEN cdp.return_fee_usd * 0.5
    -- Полная стоимость
    ELSE cdp.return_fee_usd
  END AS return_fee_usd,
  
  -- Процент скидки
  CASE
    WHEN ac.home_branch_id = tb.id THEN 100.00
    WHEN ac.desired_branch_id = tb.id THEN 100.00
    WHEN ac.days_until_future_booking IS NOT NULL 
         AND ac.days_until_future_booking < 7 THEN 100.00
    WHEN ac.days_until_future_booking IS NOT NULL 
         AND ac.days_until_future_booking >= 7 
         AND ac.days_until_future_booking <= 14 THEN 50.00
    ELSE 0.00
  END AS discount_percent
  
FROM available_cars ac
CROSS JOIN target_branch tb
CROSS JOIN target_city tc
LEFT JOIN city_delivery_pricing cdp ON 
  cdp.delivery_branch_id = ac.effective_branch_id
  AND cdp.city_id = tc.id
  AND cdp.is_active = TRUE
WHERE 
  -- Машина в целевом филиале (без доставки)
  ac.effective_branch_id = tb.id
  OR
  -- Или можно доставить из другого филиала
  cdp.id IS NOT NULL
ORDER BY 
  -- Сначала локальные машины
  is_local DESC,
  -- Потом по стоимости доставки
  delivery_fee_usd ASC,
  -- Потом по номеру
  ac.plate ASC;

-- ============================================================================
-- ПРИМЕР 2: Расчёт доплаты за нерабочее время
-- ============================================================================

-- Параметры:
-- $1: issueTime (TIMESTAMPTZ) - время выдачи
-- $2: returnTime (TIMESTAMPTZ) - время возврата

SELECT calculate_out_of_hours_fee(
  $1::TIMESTAMPTZ,
  $2::TIMESTAMPTZ
) AS out_of_hours_fee_usd;

-- Результат: 0, 20 или 40 (в зависимости от времени)

-- ============================================================================
-- ПРИМЕР 3: Полный расчёт стоимости для одной машины
-- ============================================================================

-- Параметры:
-- $1: carId (UUID) - ID машины
-- $2: targetBranchCode (TEXT) - код целевого филиала
-- $3: targetCity (TEXT) - название города
-- $4: issueTime (TIMESTAMPTZ) - время выдачи
-- $5: returnTime (TIMESTAMPTZ) - время возврата
-- $6: isOneWay (BOOLEAN) - односторонняя аренда?

WITH car_info AS (
  SELECT 
    c.id AS car_id,
    c.plate,
    c.model,
    COALESCE(cbs.future_branch_id, cbs.current_branch_id, c.branch_id) AS effective_branch_id,
    COALESCE(cbs.future_branch_code, cbs.current_branch_code, b.code) AS effective_branch_code,
    cbs.home_branch_id,
    cbs.desired_branch_id,
    cbs.days_until_future_booking
  FROM cars c
  LEFT JOIN branches b ON c.branch_id = b.id
  LEFT JOIN car_branch_states cbs ON c.id = cbs.car_id
  WHERE c.id = $1::UUID
),
delivery_data AS (
  SELECT 
    ci.*,
    tb.id AS target_branch_id,
    cdp.delivery_scope,
    CASE 
      WHEN ci.effective_branch_id = tb.id THEN 0.00
      WHEN cdp.delivery_scope = 'city' THEN cdp.in_city_fee_usd
      WHEN cdp.delivery_scope = 'airport' THEN cdp.airport_fee_usd
      ELSE cdp.intercity_fee_usd
    END AS delivery_fee_usd,
    cdp.return_fee_usd AS return_fee_base_usd
  FROM car_info ci
  CROSS JOIN (SELECT id FROM branches WHERE code = $2::TEXT) tb
  LEFT JOIN city_delivery_pricing cdp ON 
    cdp.delivery_branch_id = ci.effective_branch_id
    AND cdp.city_id = (SELECT id FROM cities WHERE name = $3::TEXT)
    AND cdp.is_active = TRUE
),
discount_calc AS (
  SELECT 
    dd.*,
    CASE
      WHEN dd.home_branch_id = dd.target_branch_id THEN 100.00
      WHEN dd.desired_branch_id = dd.target_branch_id THEN 100.00
      WHEN dd.days_until_future_booking IS NOT NULL 
           AND dd.days_until_future_booking < 7 THEN 100.00
      WHEN dd.days_until_future_booking IS NOT NULL 
           AND dd.days_until_future_booking >= 7 
           AND dd.days_until_future_booking <= 14 THEN 50.00
      ELSE 0.00
    END AS discount_percent
  FROM delivery_data dd
),
out_of_hours AS (
  SELECT calculate_out_of_hours_fee(
    $4::TIMESTAMPTZ,
    $5::TIMESTAMPTZ
  ) AS fee_usd
)
SELECT 
  dc.car_id,
  dc.plate,
  dc.model,
  dc.effective_branch_code,
  dc.target_branch_id,
  dc.delivery_scope,
  dc.delivery_fee_usd,
  CASE 
    WHEN $6::BOOLEAN THEN dc.return_fee_base_usd * (1 - dc.discount_percent / 100.0)
    ELSE 0.00
  END AS return_fee_usd,
  dc.discount_percent,
  ooh.fee_usd AS out_of_hours_fee_usd,
  -- Итоговая стоимость (без базовой аренды - её считаешь отдельно)
  dc.delivery_fee_usd + 
  CASE 
    WHEN $6::BOOLEAN THEN dc.return_fee_base_usd * (1 - dc.discount_percent / 100.0)
    ELSE 0.00
  END + 
  ooh.fee_usd AS total_delivery_fee_usd
FROM discount_calc dc
CROSS JOIN out_of_hours ooh;

-- ============================================================================
-- ПРИМЕР 4: Поиск машин с использованием VIEW (упрощённый вариант)
-- ============================================================================

-- Параметры:
-- $1: targetBranchCode (TEXT) - код целевого филиала
-- $2: targetCity (TEXT) - название города

SELECT 
  car_id,
  car_plate,
  car_model,
  current_branch_code,
  future_branch_code,
  target_branch_code,
  delivery_scope,
  final_delivery_fee_usd,
  final_one_way_fee_usd,
  discount_percent,
  can_offer_without_fee,
  days_until_future_booking
FROM car_delivery_options_view
WHERE target_branch_code = $1::TEXT
  AND city_name = $2::TEXT
ORDER BY 
  -- Сначала машины без доставки (final_delivery_fee_usd = 0)
  CASE WHEN final_delivery_fee_usd = 0 THEN 0 ELSE 1 END,
  final_delivery_fee_usd ASC;

-- ============================================================================
-- ПРИМЕР 5: Проверка доступности машины в период
-- ============================================================================

-- Параметры:
-- $1: carId (UUID) - ID машины
-- $2: issueDate (TIMESTAMPTZ) - дата выдачи
-- $3: returnDate (TIMESTAMPTZ) - дата возврата

SELECT 
  c.id AS car_id,
  c.plate,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM bookings bk
      WHERE bk.car_id = c.id
        AND bk.status NOT IN ('cancelled', 'rejected', 'deleted')
        AND (
          (bk.start_at <= $2::TIMESTAMPTZ AND bk.end_at >= $2::TIMESTAMPTZ) OR
          (bk.start_at <= $3::TIMESTAMPTZ AND bk.end_at >= $3::TIMESTAMPTZ) OR
          (bk.start_at >= $2::TIMESTAMPTZ AND bk.end_at <= $3::TIMESTAMPTZ)
        )
    ) THEN FALSE
    ELSE TRUE
  END AS is_available
FROM cars c
WHERE c.id = $1::UUID;

-- ============================================================================
-- ПРИМЕР 6: Получение информации о будущем филиале машины
-- ============================================================================

-- Параметры:
-- $1: carId (UUID) - ID машины

SELECT 
  c.id AS car_id,
  c.plate,
  cbs.current_branch_code,
  cbs.future_branch_code,
  cbs.future_booking_start_at,
  cbs.future_booking_end_at,
  cbs.days_until_future_booking,
  cbs.home_branch_code,
  cbs.desired_branch_code,
  cbs.desired_reason
FROM cars c
LEFT JOIN car_branch_states cbs ON c.id = cbs.car_id
WHERE c.id = $1::UUID;

