-- История всех операций из RentProg
CREATE TABLE IF NOT EXISTS history (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  branch TEXT NOT NULL,
  operation_type TEXT,           -- тип операции из RentProg
  operation_id TEXT,              -- ID операции в RentProg (если есть)
  description TEXT,               -- описание операции
  entity_type TEXT,               -- тип сущности (car/booking/client/payment и т.д.)
  entity_id TEXT,                 -- ID сущности
  user_name TEXT,                 -- имя пользователя
  created_at TIMESTAMPTZ,         -- время операции
  raw_data JSONB,                 -- полные данные операции
  matched BOOLEAN DEFAULT FALSE,  -- найдено ли соответствие в вебхуках
  processed BOOLEAN DEFAULT FALSE, -- обработано ли (разложено по таблицам)
  notes TEXT,                     -- заметки для ручного анализа
  
  CONSTRAINT history_branch_operation_unique UNIQUE (branch, operation_type, created_at, entity_id)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_history_branch ON history(branch);
CREATE INDEX IF NOT EXISTS idx_history_matched ON history(matched) WHERE matched = FALSE;
CREATE INDEX IF NOT EXISTS idx_history_processed ON history(processed) WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at);
CREATE INDEX IF NOT EXISTS idx_history_operation_type ON history(operation_type);

-- Комментарии
COMMENT ON TABLE history IS 'История всех операций из RentProg для последующего анализа и сопоставления с вебхуками';
COMMENT ON COLUMN history.matched IS 'TRUE если операция найдена в таблице events (пришла через вебхук)';
COMMENT ON COLUMN history.processed IS 'TRUE если операция обработана и разложена по соответствующим таблицам';
COMMENT ON COLUMN history.notes IS 'Заметки для ручного анализа: к какой таблице относится, что делать и т.д.';

