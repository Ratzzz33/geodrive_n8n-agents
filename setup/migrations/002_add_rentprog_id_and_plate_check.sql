-- 1) Добавляем столбец rentprog_id и заполняем из JSON
ALTER TABLE cars ADD COLUMN IF NOT EXISTS rentprog_id TEXT;

UPDATE cars
SET rentprog_id = data->>'id'
WHERE rentprog_id IS NULL AND data ? 'id';

-- 2) Уникальный индекс по rentprog_id (только для not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cars_rentprog_id_text
  ON cars (rentprog_id)
  WHERE rentprog_id IS NOT NULL;

-- 3) Запрет на номера вида AA-999-AA
ALTER TABLE cars DROP CONSTRAINT IF EXISTS cars_plate_no_hyphen_pattern;
ALTER TABLE cars
  ADD CONSTRAINT cars_plate_no_hyphen_pattern
  CHECK (
    plate IS NULL OR NOT (upper(plate) ~ '^[A-Z]{2}-[0-9]{3}-[A-Z]{2}$')
  );


