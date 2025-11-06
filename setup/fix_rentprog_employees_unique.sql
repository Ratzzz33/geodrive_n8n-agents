-- Добавляем UNIQUE constraint на rentprog_id для upsert
ALTER TABLE rentprog_employees 
  ADD CONSTRAINT rentprog_employees_rentprog_id_unique 
  UNIQUE (rentprog_id);

-- Добавляем индекс для company_id если его нет
CREATE INDEX IF NOT EXISTS idx_rentprog_employees_company_id 
  ON rentprog_employees(company_id);

