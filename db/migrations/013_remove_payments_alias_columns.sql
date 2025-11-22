BEGIN;

-- 1. Переносим значения alias-колонок в основные rp_* поля.
UPDATE payments
SET rp_car_id = car_id
WHERE rp_car_id IS NULL
  AND car_id IS NOT NULL;

UPDATE payments
SET rp_client_id = client_id
WHERE rp_client_id IS NULL
  AND client_id IS NOT NULL;

UPDATE payments
SET rp_user_id = user_id
WHERE rp_user_id IS NULL
  AND user_id IS NOT NULL;

-- 2. Удаляем неиспользуемые индексы по alias-колонкам.
DROP INDEX IF EXISTS idx_payments_car_id;
DROP INDEX IF EXISTS idx_payments_client_id;
DROP INDEX IF EXISTS idx_payments_user_id;

-- 3. Удаляем сами alias-колонки.
ALTER TABLE payments
  DROP COLUMN IF EXISTS car_id,
  DROP COLUMN IF EXISTS client_id,
  DROP COLUMN IF EXISTS user_id;

COMMIT;

