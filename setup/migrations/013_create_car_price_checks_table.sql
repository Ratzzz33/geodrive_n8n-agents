-- =====================================================
-- Таблица для логирования проверок цен автомобилей
-- =====================================================
-- Дата: 2025-11-09
-- Описание: Хранит результаты проверок наличия цен на сезоны

CREATE TABLE IF NOT EXISTS car_price_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Филиал
  branch TEXT NOT NULL,
  
  -- Связь с автомобилем
  car_id UUID REFERENCES cars(id) ON DELETE CASCADE,
  
  -- RentProg данные
  rentprog_car_id TEXT NOT NULL,
  car_code TEXT,
  car_number TEXT,
  car_model TEXT,
  
  -- Результаты проверки
  seasons_count INTEGER DEFAULT 0,
  prices_count INTEGER DEFAULT 0,
  missing_seasons JSONB,
  -- Структура missing_seasons:
  -- [
  --   {
  --     "seasonId": 123,
  --     "seasonName": "Winter 2024",
  --     "startDate": "2024-12-01",
  --     "endDate": "2025-02-28",
  --     "hasPrices": false,
  --     "priceValues": []
  --   }
  -- ]
  
  -- Полные данные из API (для анализа)
  check_data JSONB,
  
  -- Статус решения проблемы
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT, -- Кто решил (user_id или система)
  resolution_notes TEXT,
  
  -- Метаданные
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_car_price_checks_branch ON car_price_checks(branch);
CREATE INDEX IF NOT EXISTS idx_car_price_checks_car_id ON car_price_checks(car_id);
CREATE INDEX IF NOT EXISTS idx_car_price_checks_rentprog_id ON car_price_checks(rentprog_car_id);
CREATE INDEX IF NOT EXISTS idx_car_price_checks_resolved ON car_price_checks(resolved) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_car_price_checks_checked_at ON car_price_checks(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_car_price_checks_branch_resolved ON car_price_checks(branch, resolved);

-- GIN индекс для поиска по missing_seasons
CREATE INDEX IF NOT EXISTS idx_car_price_checks_missing_seasons_gin ON car_price_checks USING GIN (missing_seasons);

-- Комментарии
COMMENT ON TABLE car_price_checks IS 'Результаты проверок наличия цен на сезоны для автомобилей';
COMMENT ON COLUMN car_price_checks.missing_seasons IS 'JSONB массив сезонов без цен';
COMMENT ON COLUMN car_price_checks.check_data IS 'Полные данные из RentProg API /car_data_with_bookings';
COMMENT ON COLUMN car_price_checks.resolved IS 'Флаг решения проблемы (цены добавлены в RentProg)';

-- =====================================================
-- View для нерешенных проблем с ценами
-- =====================================================

CREATE OR REPLACE VIEW unresolved_price_issues AS
SELECT 
  cpc.id,
  cpc.branch,
  cpc.car_number,
  cpc.car_code,
  cpc.car_model,
  cpc.seasons_count,
  cpc.prices_count,
  cpc.seasons_count - cpc.prices_count as missing_prices_count,
  cpc.checked_at,
  c.id as car_uuid,
  c.plate
FROM car_price_checks cpc
LEFT JOIN cars c ON c.id = cpc.car_id
WHERE cpc.resolved = FALSE
  AND cpc.seasons_count > cpc.prices_count
ORDER BY cpc.checked_at DESC;

COMMENT ON VIEW unresolved_price_issues IS 'Нерешенные проблемы с ценами автомобилей';

-- =====================================================
-- Функция для получения статистики проблем с ценами
-- =====================================================

CREATE OR REPLACE FUNCTION get_price_issues_stats(p_branch TEXT DEFAULT NULL)
RETURNS TABLE (
  branch TEXT,
  total_checks INTEGER,
  cars_with_issues INTEGER,
  resolved_issues INTEGER,
  unresolved_issues INTEGER,
  last_check_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cpc.branch,
    COUNT(*)::INTEGER as total_checks,
    COUNT(DISTINCT cpc.car_id)::INTEGER as cars_with_issues,
    COUNT(*) FILTER (WHERE cpc.resolved = TRUE)::INTEGER as resolved_issues,
    COUNT(*) FILTER (WHERE cpc.resolved = FALSE)::INTEGER as unresolved_issues,
    MAX(cpc.checked_at) as last_check_at
  FROM car_price_checks cpc
  WHERE p_branch IS NULL OR cpc.branch = p_branch
  GROUP BY cpc.branch
  ORDER BY cpc.branch;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_price_issues_stats IS 'Получить статистику проблем с ценами по филиалам';

-- =====================================================
-- Функция для отметки проблемы как решенной
-- =====================================================

CREATE OR REPLACE FUNCTION resolve_price_issue(
  p_check_id UUID,
  p_resolved_by TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE car_price_checks
  SET 
    resolved = TRUE,
    resolved_at = NOW(),
    resolved_by = p_resolved_by,
    resolution_notes = p_notes,
    updated_at = NOW()
  WHERE id = p_check_id
    AND resolved = FALSE;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION resolve_price_issue IS 'Отметить проблему с ценами как решенную';

-- =====================================================
-- Примеры использования
-- =====================================================

-- Получить нерешенные проблемы
-- SELECT * FROM unresolved_price_issues;

-- Статистика по всем филиалам
-- SELECT * FROM get_price_issues_stats();

-- Статистика по конкретному филиалу
-- SELECT * FROM get_price_issues_stats('tbilisi');

-- Отметить проблему как решенную
-- SELECT resolve_price_issue('uuid-check-id', 'admin', 'Цены добавлены в RentProg');

-- Получить детали последней проверки
-- SELECT 
--   branch, 
--   car_number, 
--   seasons_count, 
--   prices_count,
--   missing_seasons,
--   checked_at
-- FROM car_price_checks
-- WHERE resolved = FALSE
-- ORDER BY checked_at DESC
-- LIMIT 10;

