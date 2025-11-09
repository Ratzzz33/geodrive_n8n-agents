-- Миграция: добавление payment_id в таблицу payments
-- Дата: 2025-11-07

-- 1. Добавить поле payment_id (если еще нет)
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS payment_id BIGINT;

-- 2. Создать уникальный индекс на (branch, payment_id)
-- Предотвращает дубли по ID платежа внутри филиала
CREATE UNIQUE INDEX IF NOT EXISTS payments_branch_payment_id_unique
  ON payments (branch, payment_id)
  WHERE payment_id IS NOT NULL;

-- 3. Создать обычный индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_payments_payment_id 
  ON payments (payment_id)
  WHERE payment_id IS NOT NULL;

-- Комментарии
COMMENT ON COLUMN payments.payment_id IS 'ID платежа из RentProg API (уникален внутри филиала)';

