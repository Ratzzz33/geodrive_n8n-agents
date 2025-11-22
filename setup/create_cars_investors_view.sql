-- ============================================================================
-- Создание VIEW для удобного получения списка машин с партнерами/инвесторами
-- Дата: 2025-11-14
-- ============================================================================

-- VIEW: Машины с информацией о партнерах
CREATE OR REPLACE VIEW cars_with_investors AS
SELECT 
  c.id as car_id,
  c.plate,
  c.vin,
  c.model,
  c.year,
  c.color,
  c.investor_id,
  
  -- Информация о филиале
  b.code as branch_code,
  b.name as branch_name,
  
  -- Информация о партнере/инвесторе (если есть в rentprog_employees)
  re.id as investor_entity_id,
  re.name as investor_name,
  re.first_name as investor_first_name,
  re.last_name as investor_last_name,
  re.email as investor_email,
  re.role as investor_role,
  re.active as investor_active,
  
  -- Даты
  c.created_at,
  c.updated_at
FROM cars c
LEFT JOIN branches b ON b.id = c.branch_id
LEFT JOIN rentprog_employees re ON re.rentprog_id = c.investor_id::text
WHERE c.investor_id IS NOT NULL;

COMMENT ON VIEW cars_with_investors IS 'Список машин с информацией о партнерах/инвесторах';

-- ============================================================================
-- VIEW: Статистика по партнерам
-- ============================================================================

CREATE OR REPLACE VIEW investor_statistics AS
SELECT 
  c.investor_id,
  re.name as investor_name,
  re.email as investor_email,
  re.role as investor_role,
  COUNT(*) as total_cars,
  STRING_AGG(DISTINCT b.code, ', ') as branches,
  STRING_AGG(c.plate, ', ' ORDER BY c.plate) as car_plates,
  MIN(c.year) as oldest_car_year,
  MAX(c.year) as newest_car_year,
  AVG(c.mileage) as avg_mileage
FROM cars c
LEFT JOIN branches b ON b.id = c.branch_id
LEFT JOIN rentprog_employees re ON re.rentprog_id = c.investor_id::text
WHERE c.investor_id IS NOT NULL
GROUP BY c.investor_id, re.name, re.email, re.role
ORDER BY total_cars DESC, c.investor_id;

COMMENT ON VIEW investor_statistics IS 'Статистика по партнерам: количество машин, филиалы, характеристики';

-- ============================================================================
-- Примеры использования
-- ============================================================================

-- Получить все машины партнера 739
-- SELECT * FROM cars_with_investors WHERE investor_id = 739;

-- Получить статистику по всем партнерам
-- SELECT * FROM investor_statistics;

-- Получить машины без партнера
-- SELECT COUNT(*) FROM cars WHERE investor_id IS NULL;

-- Получить машины по филиалам для партнера
-- SELECT branch_code, COUNT(*) as cars_count 
-- FROM cars_with_investors 
-- WHERE investor_id = 739 
-- GROUP BY branch_code;

