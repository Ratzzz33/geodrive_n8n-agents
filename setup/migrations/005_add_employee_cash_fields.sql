-- Миграция: Добавление полей кассы в таблицу employees
-- Дата: 2025-11-05
-- Назначение: Отслеживание кассы сотрудников (GEL, USD, EUR)

-- 1. Добавить поля кассы
ALTER TABLE employees 
  ADD COLUMN IF NOT EXISTS cash_gel NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_usd NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_eur NUMERIC DEFAULT 0;

-- 2. Добавить поля timestamps для кассы
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS cash_last_updated TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cash_last_synced TIMESTAMPTZ;

-- 3. Добавить поле для ID группы задач в Telegram
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS task_chat_id TEXT;

-- 4. Создать индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_employees_cash_updated 
  ON employees(cash_last_updated DESC);

CREATE INDEX IF NOT EXISTS idx_employees_task_chat 
  ON employees(task_chat_id) WHERE task_chat_id IS NOT NULL;

-- 5. Добавить комментарии
COMMENT ON COLUMN employees.cash_gel IS 'Касса сотрудника в грузинских лари';
COMMENT ON COLUMN employees.cash_usd IS 'Касса сотрудника в долларах США';
COMMENT ON COLUMN employees.cash_eur IS 'Касса сотрудника в евро';
COMMENT ON COLUMN employees.cash_last_updated IS 'Время последнего изменения кассы (из UI событий)';
COMMENT ON COLUMN employees.cash_last_synced IS 'Время последней успешной сверки с RentProg UI';
COMMENT ON COLUMN employees.task_chat_id IS 'ID группы "Tasks | <ФИО>" в Telegram';

-- 6. Проверка
DO $$ 
BEGIN
  RAISE NOTICE 'Migration 005 completed: employee cash fields added';
END $$;

