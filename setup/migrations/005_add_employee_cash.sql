-- Миграция: Добавление полей кассы для сотрудников
-- Дата: 2025-11-05
-- Описание: Добавляет поля для отслеживания кассы сотрудников в разных валютах

-- 1. Добавить поля кассы
ALTER TABLE employees 
  ADD COLUMN IF NOT EXISTS cash_gel NUMERIC(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS cash_usd NUMERIC(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS cash_eur NUMERIC(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS cash_last_updated TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cash_last_synced TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS task_chat_id TEXT;

-- 2. Добавить индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_employees_cash_updated 
  ON employees(cash_last_updated DESC) 
  WHERE cash_last_updated IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employees_cash_synced 
  ON employees(cash_last_synced DESC) 
  WHERE cash_last_synced IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employees_task_chat 
  ON employees(task_chat_id) 
  WHERE task_chat_id IS NOT NULL;

-- 3. Комментарии для документации
COMMENT ON COLUMN employees.cash_gel IS 'Касса сотрудника в лари (расчетная)';
COMMENT ON COLUMN employees.cash_usd IS 'Касса сотрудника в долларах США (расчетная)';
COMMENT ON COLUMN employees.cash_eur IS 'Касса сотрудника в евро (расчетная)';
COMMENT ON COLUMN employees.cash_last_updated IS 'Время последнего обновления кассы из событий';
COMMENT ON COLUMN employees.cash_last_synced IS 'Время последней сверки с RentProg UI (ночная проверка)';
COMMENT ON COLUMN employees.task_chat_id IS 'ID Telegram группы "Tasks | <ФИО>" для задач сотрудника';

