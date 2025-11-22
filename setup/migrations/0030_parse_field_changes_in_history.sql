-- Migration: Add field change parsing to history description parser
-- Date: 2025-11-20
-- Author: Cursor Agent
-- Issue: Changes like "изменил car_class с Средний на Эконом" are not applied to cars table

-- Step 1: Update parse_history_description to extract field changes
CREATE OR REPLACE FUNCTION public.parse_history_description(description_text text)
RETURNS TABLE(entity_type text, entity_id text, operation text, user_name text, amount text, currency text, extra jsonb)
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  booking_match TEXT;
  car_match TEXT;
  client_match TEXT;
  user_match TEXT;
  payment_ids TEXT[];
  payment_match TEXT[];
  direction TEXT;
  method TEXT := 'cash';
  service_id_match TEXT;
  service_object_match TEXT;
  service_action_match TEXT;
  service_summary TEXT;
  
  -- Field change parsing
  field_name TEXT;
  old_value TEXT;
  new_value TEXT;
  changes_jsonb JSONB := '{}'::jsonb;
BEGIN
  entity_type := NULL;
  entity_id := NULL;
  operation := NULL;
  user_name := NULL;
  amount := NULL;
  currency := NULL;
  extra := '{}'::jsonb;
  
  IF description_text IS NULL OR description_text = '' THEN
    RETURN;
  END IF;
  
  -- Имя пользователя
  user_match := substring(description_text from '^([А-Яа-яёЁA-Za-z\s]+?)\s+(изменил|создал|принял|выдал|удалил|отменил|завершил)');
  IF user_match IS NOT NULL THEN
    user_name := trim(user_match);
  END IF;
  
  -- Тип операции
  IF description_text ~* 'создал|created' THEN
    operation := 'create';
  ELSIF description_text ~* 'изменил|changed|updated' THEN
    operation := 'update';
  ELSIF description_text ~* 'удалил|deleted' THEN
    operation := 'delete';
  ELSIF description_text ~* 'принял|accepted|returned' THEN
    operation := 'return';
  ELSIF description_text ~* 'выдал|issued' THEN
    operation := 'issue';
  ELSIF description_text ~* 'завершил' THEN
    operation := 'complete';
  ELSE
    operation := 'unknown';
  END IF;
  
  -- Parse field changes: "изменил FIELD_NAME с OLD_VALUE на NEW_VALUE"
  IF operation = 'update' AND description_text ~* 'изменил\s+(\w+)\s+с\s+(.+?)\s+на\s+(.+?)\s*[,\.]?\s*(?:в|$)' THEN
    -- Extract field name, old value, new value
    field_name := substring(description_text from 'изменил\s+(\w+)\s+с');
    old_value := substring(description_text from 'изменил\s+\w+\s+с\s+(.+?)\s+на');
    new_value := substring(description_text from 'на\s+(.+?)\s*[,\.]?\s*(?:в|$)');
    
    IF field_name IS NOT NULL AND new_value IS NOT NULL THEN
      -- Normalize field name and value
      field_name := trim(field_name);
      new_value := trim(new_value);
      old_value := trim(old_value);
      
      -- Remove trailing comma or period from new_value
      new_value := regexp_replace(new_value, '[,\.]$', '');
      
      -- Store in changes
      changes_jsonb := jsonb_build_object(field_name, new_value);
    END IF;
  END IF;
  
  -- Брони
  booking_match := substring(description_text from '(?i)(?:бронь|booking|бронирование)[^0-9#№]*(?:[#№]\s*)?(\d+)');
  IF booking_match IS NOT NULL THEN
    entity_type := 'booking';
    entity_id := booking_match;
    IF changes_jsonb != '{}'::jsonb THEN
      extra := jsonb_set(extra, '{changes}', changes_jsonb);
    END IF;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Обслуживание (service tasks)
  IF description_text ~* 'обслужив' THEN
    service_action_match := substring(description_text from '(?i)(создал|завершил|удалил)\s+обслуживание');
    service_id_match := substring(description_text from '(?i)обслуживание[^0-9#№]*(?:[#№]\s*)?(\d+)');
    service_object_match := substring(description_text from '(?i)(?:объекте|object)[^0-9#№]*(?:[#№]\s*)?(\d+)');
    
    service_summary := NULL;
    IF description_text ~* '(?:объекте|object)[^#№\d]*(?:[#№]\s*)?\d+\s+(.+)$' THEN
      service_summary := btrim(
        regexp_replace(
          description_text,
          '.*(?:объекте|object)[^#№\d]*(?:[#№]\s*)?\d+\s*',
          '',
          1,
          1,
          'i'
        )
      );
    END IF;
    
    IF service_id_match IS NOT NULL THEN
      entity_type := 'car';
      entity_id := service_object_match;
      extra := jsonb_set(extra, '{service}', jsonb_strip_nulls(jsonb_build_object(
        'service_id', service_id_match,
        'object_id', service_object_match,
        'action', CASE 
                    WHEN service_action_match ILIKE 'создал%' THEN 'created'
                    WHEN service_action_match ILIKE 'завершил%' THEN 'completed'
                    WHEN service_action_match ILIKE 'удалил%' THEN 'deleted'
                    ELSE NULL
                  END,
        'summary', service_summary
      )));
      IF changes_jsonb != '{}'::jsonb THEN
        extra := jsonb_set(extra, '{changes}', changes_jsonb);
      END IF;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;
  
  -- Платежи (Parser/StarMech/и т.д.)
  payment_ids := ARRAY[]::TEXT[];
  FOR payment_match IN
    SELECT regexp_matches(description_text, '(?:плат(?:е|ё)ж(?:и)?[^\d]*(\d+(?:/\d+)*))', 'gi')
  LOOP
    payment_ids := payment_ids || string_to_array(payment_match[1], '/');
  END LOOP;
  
  IF array_length(payment_ids, 1) > 0 THEN
    entity_type := 'payment';
    entity_id := payment_ids[1];
    
    -- Сумма / валюта
    SELECT m[1], upper(m[2]) INTO amount, currency
    FROM regexp_matches(description_text, '([0-9]+(?:[\\.,][0-9]+)?)\s*(GEL|USD|EUR)', 'gi') AS m
    LIMIT 1;
    
    IF amount IS NOT NULL THEN
      amount := replace(amount, ',', '.');
    END IF;
    
    IF currency IS NULL THEN
      currency := 'GEL';
    END IF;
    
    -- Направление платежа
    IF description_text ~* 'расход' OR description_text ~* 'выдал' THEN
      direction := 'expense';
    ELSIF description_text ~* 'принял' OR description_text ~* 'приход' THEN
      direction := 'income';
    ELSE
      direction := NULL;
    END IF;
    
    IF description_text ~* 'безнал' OR description_text ~* 'card' THEN
      method := 'cashless';
    ELSE
      method := 'cash';
    END IF;
    
    extra := jsonb_set(extra, '{payment_ids}', to_jsonb(payment_ids));
    IF direction IS NOT NULL THEN
      extra := jsonb_set(extra, '{payment_direction}', to_jsonb(direction));
    END IF;
    extra := jsonb_set(extra, '{payment_method}', to_jsonb(method));
    
    IF changes_jsonb != '{}'::jsonb THEN
      extra := jsonb_set(extra, '{changes}', changes_jsonb);
    END IF;
    
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Авто
  car_match := substring(description_text from '(?i)(?:авто|car|машина|автомобиль)[^0-9#№]*(?:[#№]\s*)?(\d+)');
  IF car_match IS NOT NULL THEN
    entity_type := 'car';
    entity_id := car_match;
    IF changes_jsonb != '{}'::jsonb THEN
      extra := jsonb_set(extra, '{changes}', changes_jsonb);
    END IF;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Клиенты
  client_match := substring(description_text from '(?i)(?:клиент|client)[^0-9#№]*(?:[#№]\s*)?(\d+)');
  IF client_match IS NOT NULL THEN
    entity_type := 'client';
    entity_id := client_match;
    IF changes_jsonb != '{}'::jsonb THEN
      extra := jsonb_set(extra, '{changes}', changes_jsonb);
    END IF;
    RETURN NEXT;
    RETURN;
  END IF;
  
  RETURN;
END;
$function$;

-- Step 2: Update auto_process_history_trigger to use changes from extra
CREATE OR REPLACE FUNCTION public.auto_process_history_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  parsed RECORD;
  applied BOOLEAN;
  notes_text TEXT;
  raw_data_to_apply JSONB;
BEGIN
  IF NEW.processed = TRUE THEN
    RETURN NEW;
  END IF;
  
  IF NEW.description IS NULL OR NEW.description = '' THEN
    RETURN NEW;
  END IF;
  
  SELECT * INTO parsed
  FROM parse_history_description(NEW.description)
  LIMIT 1;
  
  IF parsed.entity_type IS NULL OR parsed.entity_id IS NULL THEN
    NEW.notes := COALESCE(NEW.notes, '') || ' | Не удалось распарсить description';
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
  
  IF applied THEN
    NEW.processed := TRUE;
    NEW.notes := COALESCE(NEW.notes, '') || ' | Обработано автоматически через триггер';
  ELSE
    notes_text := ' | Парсинг успешен, но изменения не применены (сущность не найдена в БД?)';
    NEW.notes := COALESCE(NEW.notes, '') || notes_text;
  END IF;
  
  PERFORM pg_notify(
    'history_item_processed',
    NEW.id::TEXT || '|' || NEW.branch || '|' ||
    COALESCE(parsed.entity_type, 'unknown') || '|' ||
    COALESCE(parsed.entity_id, '')
  );
  
  RETURN NEW;
END;
$function$;

-- Verify the functions were created successfully
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'parse_history_description'
  ) THEN
    RAISE EXCEPTION 'Failed to create parse_history_description function';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'auto_process_history_trigger'
  ) THEN
    RAISE EXCEPTION 'Failed to create auto_process_history_trigger function';
  END IF;
  
  RAISE NOTICE 'Successfully updated parse_history_description and auto_process_history_trigger';
  RAISE NOTICE 'Now history changes like "изменил car_class с Средний на Эконом" will be parsed and applied';
END $$;

