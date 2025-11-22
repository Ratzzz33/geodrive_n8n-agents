-- Migration: Create history_audit table for complete audit trail
-- Date: 2025-11-20
-- Author: Cursor Agent
-- Purpose: Save ALL events with author information, even duplicates

-- Step 1: Create history_audit table (no unique constraints - saves everything)
CREATE TABLE IF NOT EXISTS history_audit (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  branch TEXT NOT NULL,
  operation_type TEXT,
  operation_id TEXT,
  description TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  user_name TEXT,              -- КТО сделал изменение (важно!)
  created_at TIMESTAMPTZ,      -- Когда произошло в RentProg
  raw_data JSONB,              -- Полные данные операции
  processed BOOLEAN DEFAULT FALSE,
  error_code TEXT,
  notes TEXT
);

-- Step 2: Create indexes for fast search (NO UNIQUE - save everything!)
CREATE INDEX IF NOT EXISTS idx_history_audit_branch ON history_audit(branch);
CREATE INDEX IF NOT EXISTS idx_history_audit_entity ON history_audit(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_history_audit_user ON history_audit(user_name);
CREATE INDEX IF NOT EXISTS idx_history_audit_created_at ON history_audit(created_at);
CREATE INDEX IF NOT EXISTS idx_history_audit_operation_id ON history_audit(operation_id);
CREATE INDEX IF NOT EXISTS idx_history_audit_processed ON history_audit(processed) WHERE processed = FALSE;

-- Step 3: Add comment
COMMENT ON TABLE history_audit IS 'Полный аудит всех событий из RentProg. Сохраняет ВСЕ события, включая дубликаты, для отслеживания автора изменений.';

-- Step 4: Create function to copy from history to history_audit
-- This function will be called BOTH from trigger AND from workflow
CREATE OR REPLACE FUNCTION copy_history_to_audit(
  p_branch TEXT,
  p_operation_type TEXT,
  p_operation_id TEXT,
  p_description TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_user_name TEXT,
  p_created_at TIMESTAMPTZ,
  p_raw_data JSONB,
  p_processed BOOLEAN DEFAULT FALSE,
  p_error_code TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
  new_id BIGINT;
BEGIN
  -- Вставляем в history_audit БЕЗ проверки на дубликаты
  INSERT INTO history_audit (
    branch,
    operation_type,
    operation_id,
    description,
    entity_type,
    entity_id,
    user_name,
    created_at,
    raw_data,
    processed,
    error_code,
    notes,
    ts
  ) VALUES (
    p_branch,
    p_operation_type,
    p_operation_id,
    p_description,
    p_entity_type,
    p_entity_id,
    p_user_name,
    p_created_at,
    p_raw_data,
    p_processed,
    p_error_code,
    p_notes,
    NOW()
  ) RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger function to auto-copy from history to history_audit
CREATE OR REPLACE FUNCTION copy_history_to_audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Автоматически копировать каждую запись из history в history_audit
  INSERT INTO history_audit (
    branch,
    operation_type,
    operation_id,
    description,
    entity_type,
    entity_id,
    user_name,
    created_at,
    raw_data,
    processed,
    error_code,
    notes,
    ts
  ) VALUES (
    NEW.branch,
    NEW.operation_type,
    NEW.operation_id,
    NEW.description,
    NEW.entity_type,
    NEW.entity_id,
    NEW.user_name,
    NEW.created_at,
    NEW.raw_data,
    NEW.processed,
    NEW.error_code,
    NEW.notes,
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger
DROP TRIGGER IF EXISTS history_to_audit_trigger ON history;
CREATE TRIGGER history_to_audit_trigger
  AFTER INSERT OR UPDATE ON history
  FOR EACH ROW
  EXECUTE FUNCTION copy_history_to_audit_trigger();

-- Step 7: Backfill existing records (optional - можно запустить отдельно)
-- INSERT INTO history_audit SELECT * FROM history;

-- Verify
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'history_audit'
  ) THEN
    RAISE EXCEPTION 'Failed to create history_audit table';
  END IF;
  
  RAISE NOTICE 'Successfully created history_audit table';
  RAISE NOTICE 'Trigger created: all new history records will be copied to history_audit';
  RAISE NOTICE 'history_audit saves ALL events, including duplicates, for complete audit trail';
END $$;

