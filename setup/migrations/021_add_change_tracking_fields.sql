-- =====================================================
-- Миграция 021: Добавление полей для отслеживания источника изменений
-- =====================================================
-- Дата: 2025-01-20
-- Описание: Добавляем поля для отслеживания, кто/что изменило данные в БД

BEGIN;

-- 1. Добавляем поля в таблицу cars
ALTER TABLE cars ADD COLUMN IF NOT EXISTS updated_by_source TEXT;
-- Типы источников: 'rentprog_webhook', 'rentprog_history', 'snapshot_workflow', 
--                  'jarvis_api', 'manual', 'n8n_workflow', 'trigger', 'migration'
COMMENT ON COLUMN cars.updated_by_source IS 'Источник изменения: rentprog_webhook, rentprog_history, snapshot_workflow, jarvis_api, manual, n8n_workflow, trigger, migration';

ALTER TABLE cars ADD COLUMN IF NOT EXISTS updated_by_workflow TEXT;
COMMENT ON COLUMN cars.updated_by_workflow IS 'ID или название workflow/скрипта, который изменил данные';

ALTER TABLE cars ADD COLUMN IF NOT EXISTS updated_by_function TEXT;
COMMENT ON COLUMN cars.updated_by_function IS 'Название функции/метода, который изменил данные (например: upsertCarFromRentProg)';

ALTER TABLE cars ADD COLUMN IF NOT EXISTS updated_by_execution_id TEXT;
COMMENT ON COLUMN cars.updated_by_execution_id IS 'ID execution в n8n или другой системе';

ALTER TABLE cars ADD COLUMN IF NOT EXISTS updated_by_user TEXT;
COMMENT ON COLUMN cars.updated_by_user IS 'Пользователь, который инициировал изменение (если есть)';

ALTER TABLE cars ADD COLUMN IF NOT EXISTS updated_by_metadata JSONB;
COMMENT ON COLUMN cars.updated_by_metadata IS 'Дополнительные метаданные об источнике изменения';

-- 2. Добавляем поля в таблицу car_prices
ALTER TABLE car_prices ADD COLUMN IF NOT EXISTS updated_by_source TEXT;
COMMENT ON COLUMN car_prices.updated_by_source IS 'Источник изменения цен';

ALTER TABLE car_prices ADD COLUMN IF NOT EXISTS updated_by_workflow TEXT;
COMMENT ON COLUMN car_prices.updated_by_workflow IS 'ID или название workflow/скрипта';

ALTER TABLE car_prices ADD COLUMN IF NOT EXISTS updated_by_function TEXT;
COMMENT ON COLUMN car_prices.updated_by_function IS 'Название функции/метода';

ALTER TABLE car_prices ADD COLUMN IF NOT EXISTS updated_by_execution_id TEXT;
COMMENT ON COLUMN car_prices.updated_by_execution_id IS 'ID execution';

ALTER TABLE car_prices ADD COLUMN IF NOT EXISTS updated_by_user TEXT;
COMMENT ON COLUMN car_prices.updated_by_user IS 'Пользователь';

ALTER TABLE car_prices ADD COLUMN IF NOT EXISTS updated_by_metadata JSONB;
COMMENT ON COLUMN car_prices.updated_by_metadata IS 'Дополнительные метаданные';

-- 3. Добавляем поля в таблицу clients (для полноты)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_by_source TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_by_workflow TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_by_function TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_by_execution_id TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_by_user TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_by_metadata JSONB;

-- 4. Добавляем поля в таблицу bookings (для полноты)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_by_source TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_by_workflow TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_by_function TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_by_execution_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_by_user TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_by_metadata JSONB;

-- 5. Создаем индексы для быстрого поиска по источнику
CREATE INDEX IF NOT EXISTS idx_cars_updated_by_source ON cars(updated_by_source);
CREATE INDEX IF NOT EXISTS idx_cars_updated_by_workflow ON cars(updated_by_workflow);
CREATE INDEX IF NOT EXISTS idx_car_prices_updated_by_source ON car_prices(updated_by_source);
CREATE INDEX IF NOT EXISTS idx_car_prices_updated_by_workflow ON car_prices(updated_by_workflow);

-- 6. Создаем функцию для установки источника изменения (helper)
CREATE OR REPLACE FUNCTION set_update_source(
  source_type TEXT,
  workflow_name TEXT DEFAULT NULL,
  function_name TEXT DEFAULT NULL,
  execution_id TEXT DEFAULT NULL,
  user_name TEXT DEFAULT NULL,
  metadata JSONB DEFAULT NULL
) RETURNS JSONB AS $$
BEGIN
  RETURN jsonb_build_object(
    'source', source_type,
    'workflow', workflow_name,
    'function', function_name,
    'execution_id', execution_id,
    'user', user_name,
    'metadata', COALESCE(metadata, '{}'::jsonb),
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_update_source IS 'Helper функция для создания JSONB объекта с информацией об источнике изменения';

COMMIT;

