-- Migration: Add error_code field to history table for tracking processing status
-- Date: 2025-11-20
-- Author: Cursor Agent
-- Purpose: Track processing errors with unique error codes for easy debugging

-- Step 1: Add error_code column to history table
ALTER TABLE history 
ADD COLUMN IF NOT EXISTS error_code TEXT;

-- Step 2: Create index for faster queries on error_code
CREATE INDEX IF NOT EXISTS idx_history_error_code ON history(error_code) WHERE error_code IS NOT NULL;

-- Step 3: Update auto_process_history_trigger to set error codes
CREATE OR REPLACE FUNCTION public.auto_process_history_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  parsed RECORD;
  applied BOOLEAN;
  notes_text TEXT;
  raw_data_to_apply JSONB;
  error_code_value TEXT;
BEGIN
  -- Reset error_code on each trigger run
  NEW.error_code := NULL;
  
  IF NEW.processed = TRUE THEN
    RETURN NEW;
  END IF;
  
  IF NEW.description IS NULL OR NEW.description = '' THEN
    NEW.error_code := 'HISTORY_ERR_EMPTY_DESCRIPTION';
    NEW.notes := COALESCE(NEW.notes, '') || ' | Ошибка: пустое описание';
    RETURN NEW;
  END IF;
  
  -- Try to parse description
  BEGIN
    SELECT * INTO parsed
    FROM parse_history_description(NEW.description)
    LIMIT 1;
  EXCEPTION WHEN others THEN
    NEW.error_code := 'HISTORY_ERR_PARSE_EXCEPTION';
    NEW.notes := COALESCE(NEW.notes, '') || ' | Ошибка парсинга: ' || SQLERRM;
    RETURN NEW;
  END;
  
  IF parsed.entity_type IS NULL OR parsed.entity_id IS NULL THEN
    NEW.error_code := 'HISTORY_ERR_PARSE_FAILED';
    NEW.notes := COALESCE(NEW.notes, '') || ' | Не удалось распарсить description (entity_type или entity_id не найдены)';
    RETURN NEW;
  END IF;
  
  IF parsed.extra IS NULL THEN
    parsed.extra := '{}'::jsonb;
  END IF;
  
  IF NEW.entity_type IS NULL THEN
    NEW.entity_type := parsed.entity_type;
  END IF;
  
  IF NEW.entity_id IS NULL THEN
    NEW.entity_id := parsed.entity_id;
  END IF;
  
  IF NEW.user_name IS NULL AND parsed.user_name IS NOT NULL THEN
    NEW.user_name := parsed.user_name;
  END IF;
  
  -- Use changes from extra if available, otherwise use NEW.raw_data
  raw_data_to_apply := NEW.raw_data;
  IF parsed.extra ? 'changes' THEN
    raw_data_to_apply := COALESCE(raw_data_to_apply, '{}'::jsonb) || (parsed.extra->'changes');
  END IF;
  
  -- Try to apply changes
  BEGIN
    applied := apply_history_changes(
      NEW.id,
      parsed.entity_type,
      parsed.entity_id,
      parsed.operation,
      NEW.branch,
      COALESCE(NEW.user_name, parsed.user_name),
      raw_data_to_apply,
      NEW.description,
      parsed.amount,
      parsed.currency,
      parsed.extra
    );
  EXCEPTION WHEN others THEN
    NEW.error_code := 'HISTORY_ERR_APPLY_EXCEPTION';
    NEW.notes := COALESCE(NEW.notes, '') || ' | Ошибка применения изменений: ' || SQLERRM;
    RETURN NEW;
  END;
  
  IF applied THEN
    -- Success: error_code remains NULL
    NEW.processed := TRUE;
    NEW.notes := COALESCE(NEW.notes, '') || ' | Обработано автоматически через триггер';
  ELSE
    -- Failed: set error code
    NEW.error_code := 'HISTORY_ERR_ENTITY_NOT_FOUND';
    notes_text := ' | Парсинг успешен, но изменения не применены (сущность не найдена в БД?)';
    NEW.notes := COALESCE(NEW.notes, '') || notes_text;
  END IF;
  
  PERFORM pg_notify(
    'history_item_processed',
    NEW.id::TEXT || '|' || NEW.branch || '|' ||
    COALESCE(parsed.entity_type, 'unknown') || '|' ||
    COALESCE(parsed.entity_id, '') || '|' ||
    COALESCE(NEW.error_code, 'SUCCESS')
  );
  
  RETURN NEW;
END;
$function$;

-- Step 4: Create helper function to get error code description
CREATE OR REPLACE FUNCTION public.get_history_error_description(error_code_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $function$
BEGIN
  CASE error_code_text
    WHEN 'HISTORY_ERR_EMPTY_DESCRIPTION' THEN
      RETURN 'Пустое описание события';
    WHEN 'HISTORY_ERR_PARSE_EXCEPTION' THEN
      RETURN 'Исключение при парсинге описания (SQL ошибка)';
    WHEN 'HISTORY_ERR_PARSE_FAILED' THEN
      RETURN 'Не удалось распарсить описание (entity_type или entity_id не найдены)';
    WHEN 'HISTORY_ERR_APPLY_EXCEPTION' THEN
      RETURN 'Исключение при применении изменений (SQL ошибка в apply_history_changes)';
    WHEN 'HISTORY_ERR_ENTITY_NOT_FOUND' THEN
      RETURN 'Сущность не найдена в БД (нет записи в external_refs или целевой таблице)';
    ELSE
      -- Support old codes for backward compatibility
      CASE error_code_text
        WHEN 'ERR_EMPTY_DESCRIPTION' THEN
          RETURN 'Пустое описание события (старый код, используйте HISTORY_ERR_EMPTY_DESCRIPTION)';
        WHEN 'ERR_PARSE_EXCEPTION' THEN
          RETURN 'Исключение при парсинге описания (старый код, используйте HISTORY_ERR_PARSE_EXCEPTION)';
        WHEN 'ERR_PARSE_FAILED' THEN
          RETURN 'Не удалось распарсить описание (старый код, используйте HISTORY_ERR_PARSE_FAILED)';
        WHEN 'ERR_APPLY_EXCEPTION' THEN
          RETURN 'Исключение при применении изменений (старый код, используйте HISTORY_ERR_APPLY_EXCEPTION)';
        WHEN 'ERR_ENTITY_NOT_FOUND' THEN
          RETURN 'Сущность не найдена в БД (старый код, используйте HISTORY_ERR_ENTITY_NOT_FOUND)';
        ELSE
          RETURN 'Неизвестный код ошибки: ' || COALESCE(error_code_text, 'NULL');
      END CASE;
  END CASE;
END;
$function$;

-- Step 5: Verify the changes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'history' AND column_name = 'error_code'
  ) THEN
    RAISE EXCEPTION 'Failed to add error_code column to history table';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'auto_process_history_trigger'
  ) THEN
    RAISE EXCEPTION 'Failed to update auto_process_history_trigger function';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_history_error_description'
  ) THEN
    RAISE EXCEPTION 'Failed to create get_history_error_description function';
  END IF;
  
  RAISE NOTICE 'Successfully added error_code field to history table';
  RAISE NOTICE 'Updated auto_process_history_trigger to set error codes';
  RAISE NOTICE 'Created get_history_error_description helper function';
  RAISE NOTICE '';
  RAISE NOTICE 'Error codes (with HISTORY_ERR_ prefix):';
  RAISE NOTICE '  HISTORY_ERR_EMPTY_DESCRIPTION - пустое описание';
  RAISE NOTICE '  HISTORY_ERR_PARSE_EXCEPTION - SQL ошибка при парсинге';
  RAISE NOTICE '  HISTORY_ERR_PARSE_FAILED - не удалось распарсить (entity не найден)';
  RAISE NOTICE '  HISTORY_ERR_APPLY_EXCEPTION - SQL ошибка при применении';
  RAISE NOTICE '  HISTORY_ERR_ENTITY_NOT_FOUND - сущность не найдена в БД';
  RAISE NOTICE '';
  RAISE NOTICE 'Если error_code = NULL, значит обработка прошла успешно!';
  RAISE NOTICE 'Просто скопируйте код ошибки (например: HISTORY_ERR_ENTITY_NOT_FOUND) для быстрого поиска!';
END $$;

