-- Ensure we can use ON CONFLICT (rentprog_id) in n8n upserts
-- Existing expression index (idx_cars_rentprog_id_text) не подходит для ON CONFLICT
-- Создаем прямой уникальный индекс по колонке rentprog_id

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_cars_rentprog_id'
      AND n.nspname = 'public'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX idx_cars_rentprog_id ON public.cars (rentprog_id)';
  END IF;
END;
$$;

