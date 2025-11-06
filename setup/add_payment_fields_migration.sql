-- Миграция: расширение таблицы payments
-- Добавляем поля из raw_data для быстрого доступа и очистки raw_data
-- Дата: 2025-11-07

-- RentProg IDs (для связи с RentProg сущностями)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS rp_payment_id BIGINT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS rp_car_id BIGINT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS rp_user_id BIGINT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS rp_client_id BIGINT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS rp_company_id BIGINT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS rp_cashbox_id BIGINT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS rp_category_id BIGINT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS rp_subcategory_id BIGINT;

-- Коды и названия
ALTER TABLE payments ADD COLUMN IF NOT EXISTS car_code TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_subgroup TEXT;

-- Финансовые данные (numeric as text для точности)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS exchange_rate TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS rated_amount TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS last_balance TEXT;

-- Статусы (boolean для фильтрации)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS has_check BOOLEAN DEFAULT FALSE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_operation BOOLEAN DEFAULT FALSE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_tinkoff_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_client_balance BOOLEAN DEFAULT FALSE;

-- Дополнительные связи
ALTER TABLE payments ADD COLUMN IF NOT EXISTS debt_id BIGINT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS agent_id BIGINT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS investor_id BIGINT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS contractor_id BIGINT;

-- Даты завершения
ALTER TABLE payments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS completed_by BIGINT;

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_payments_rp_payment_id ON payments(rp_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_rp_car_id ON payments(rp_car_id);
CREATE INDEX IF NOT EXISTS idx_payments_rp_user_id ON payments(rp_user_id);
CREATE INDEX IF NOT EXISTS idx_payments_rp_category_id ON payments(rp_category_id);
CREATE INDEX IF NOT EXISTS idx_payments_has_check ON payments(has_check) WHERE has_check = TRUE;
CREATE INDEX IF NOT EXISTS idx_payments_is_completed ON payments(is_completed);
CREATE INDEX IF NOT EXISTS idx_payments_car_code ON payments(car_code);

-- Комментарии к полям
COMMENT ON COLUMN payments.rp_payment_id IS 'ID платежа в RentProg (raw_data.id)';
COMMENT ON COLUMN payments.rp_car_id IS 'ID автомобиля в RentProg';
COMMENT ON COLUMN payments.rp_user_id IS 'ID пользователя в RentProg (сотрудник)';
COMMENT ON COLUMN payments.rp_category_id IS 'ID категории платежа в RentProg';
COMMENT ON COLUMN payments.car_code IS 'Код автомобиля (например: Ford Mustang 648)';
COMMENT ON COLUMN payments.exchange_rate IS 'Курс обмена валюты';
COMMENT ON COLUMN payments.rated_amount IS 'Сумма с учетом курса';
COMMENT ON COLUMN payments.last_balance IS 'Остаток после операции';
COMMENT ON COLUMN payments.has_check IS 'Наличие чека';
COMMENT ON COLUMN payments.is_operation IS 'Является ли операцией (а не просто записью)';

