-- Разрешить NULL в поле name таблицы employees
ALTER TABLE employees 
  ALTER COLUMN name DROP NOT NULL;

