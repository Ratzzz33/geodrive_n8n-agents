-- Migration: Fix ambiguous rentprog_id error in apply_history_changes
-- Date: 2025-11-20
-- Author: Cursor Agent
-- Issue: column reference "rentprog_id" is ambiguous

-- Drop and recreate the function with explicit table aliases where needed
CREATE OR REPLACE FUNCTION public.apply_history_changes(
  history_id bigint,
  entity_type_value text,
  entity_id_value text,
  operation_value text,
  branch_code text,
  user_name_value text,
  raw_data_value jsonb,
  description_value text,
  amount_value text,
  currency_value text,
  extra_data jsonb
)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
DECLARE
  internal_uuid UUID;
  booking_uuid UUID;
  car_uuid UUID;
  client_uuid UUID;
  payment_uuid UUID;
  payment_ids TEXT[];
  payment_id TEXT;
  amount_text TEXT;
  currency_text TEXT;
  direction TEXT;
  method TEXT;
  payment_date TIMESTAMPTZ;
  history_entry JSONB;
  new_status TEXT;
  result BOOLEAN := FALSE;
BEGIN
  IF entity_type_value IS NULL OR entity_id_value IS NULL OR entity_id_value = '' THEN
    RETURN FALSE;
  END IF;
  
  IF extra_data IS NULL THEN
    extra_data := '{}'::jsonb;
  END IF;
  
  -- Общий поиск UUID через external_refs
  -- Используем явный alias 'er' для таблицы external_refs
  SELECT er.entity_id INTO internal_uuid
  FROM external_refs er
  WHERE er.system = 'rentprog' 
    AND er.external_id = entity_id_value 
    AND er.entity_type = entity_type_value
  LIMIT 1;
  
  CASE entity_type_value
    WHEN 'booking' THEN
      IF internal_uuid IS NULL THEN
        RETURN FALSE;
      END IF;
      
      history_entry := jsonb_strip_nulls(jsonb_build_object(
        'history_id', history_id,
        'operation', operation_value,
        'description', description_value,
        'user_name', user_name_value,
        'branch', branch_code,
        'extra', extra_data,
        'raw', raw_data_value,
        'amount', amount_value,
        'currency', currency_value,
        'created_at', NOW()
      ));
      
      new_status := NULL;
      IF operation_value = 'issue' THEN
        new_status := 'active';
      ELSIF operation_value = 'return' THEN
        new_status := 'completed';
      ELSIF operation_value = 'create' THEN
        new_status := 'planned';
      END IF;
      
      -- Используем явный alias 'b' для таблицы bookings
      UPDATE bookings b
      SET 
        status = COALESCE(new_status, b.status),
        updated_at = NOW(),
        history_log = COALESCE(b.history_log, '[]'::jsonb) || jsonb_build_array(history_entry)
      WHERE b.id = internal_uuid;
      result := TRUE;
      
    WHEN 'car' THEN
      IF internal_uuid IS NULL THEN
        RETURN FALSE;
      END IF;
      
      IF extra_data ? 'service' THEN
        result := process_car_service_task(
          history_id,
          internal_uuid,
          entity_id_value,
          branch_code,
          user_name_value,
          extra_data->'service',
          description_value
        );
      ELSIF raw_data_value IS NOT NULL AND operation_value = 'update' THEN
        -- Используем явный alias 'c' для таблицы cars
        UPDATE cars c
        SET 
          updated_at = NOW(),
          data = COALESCE(c.data, '{}'::jsonb) || raw_data_value
        WHERE c.id = internal_uuid;
        result := TRUE;
      END IF;
      
    WHEN 'client' THEN
      IF internal_uuid IS NULL THEN
        RETURN FALSE;
      END IF;
      IF raw_data_value IS NOT NULL AND operation_value = 'update' THEN
        -- Используем явный alias 'cl' для таблицы clients
        UPDATE clients cl
        SET 
          updated_at = NOW(),
          data = COALESCE(cl.data, '{}'::jsonb) || raw_data_value
        WHERE cl.id = internal_uuid;
        result := TRUE;
      END IF;
      
    WHEN 'payment' THEN
      payment_ids := ARRAY[entity_id_value];
      IF extra_data ? 'payment_ids' THEN
        payment_ids := payment_ids || ARRAY(
          SELECT jsonb_array_elements_text(extra_data->'payment_ids')
        );
      END IF;
      
      payment_ids := ARRAY(
        SELECT DISTINCT val FROM unnest(payment_ids) AS val
        WHERE val IS NOT NULL AND val <> ''
      );
      
      IF array_length(payment_ids, 1) = 0 THEN
        RETURN FALSE;
      END IF;
      
      amount_text := COALESCE(amount_value, raw_data_value->>'sum', '0');
      amount_text := replace(amount_text, ',', '.');
      currency_text := COALESCE(currency_value, upper(raw_data_value->>'currency'), 'GEL');
      direction := COALESCE(extra_data->>'payment_direction', CASE WHEN operation_value = 'create' THEN 'income' ELSE 'unknown' END);
      method := COALESCE(extra_data->>'payment_method', 'cash');
      
      payment_date := NULL;
      IF raw_data_value ? 'created_at' THEN
        BEGIN
          payment_date := (raw_data_value->>'created_at')::timestamptz;
        EXCEPTION WHEN others THEN
          payment_date := NULL;
        END;
      END IF;
      payment_date := COALESCE(payment_date, NOW());
      
      FOR payment_id IN SELECT unnest(payment_ids)
      LOOP
        CONTINUE WHEN payment_id IS NULL OR payment_id = '';
        BEGIN
          -- Используем явный alias 'er_p' для external_refs в payment context
          SELECT er_p.entity_id INTO payment_uuid
          FROM external_refs er_p
          WHERE er_p.system = 'rentprog'
            AND er_p.entity_type = 'payment'
            AND er_p.external_id = payment_id
          LIMIT 1;
          
          IF payment_uuid IS NULL THEN
            -- Используем явный alias 'p' для таблицы payments
            INSERT INTO payments (
              branch,
              payment_date,
              payment_type,
              payment_method,
              amount,
              currency,
              description,
              rp_payment_id,
              raw_data
            )
            VALUES (
              branch_code,
              payment_date,
              direction,
              method,
              amount_text,
              currency_text,
              description_value,
              payment_id::int,
              raw_data_value
            )
            ON CONFLICT (branch, rp_payment_id)
            DO UPDATE SET
              payment_date = EXCLUDED.payment_date,
              amount = EXCLUDED.amount,
              currency = EXCLUDED.currency,
              description = EXCLUDED.description
            RETURNING id INTO payment_uuid;
            
            INSERT INTO external_refs (
              entity_type,
              entity_id,
              system,
              external_id,
              branch_code,
              created_at,
              updated_at
            )
            VALUES (
              'payment',
              payment_uuid,
              'rentprog',
              payment_id,
              branch_code,
              NOW(),
              NOW()
            )
            ON CONFLICT DO NOTHING;
          END IF;
          
          result := TRUE;
        EXCEPTION
          WHEN invalid_text_representation THEN
            CONTINUE;
        END;
      END LOOP;
      
    ELSE
      IF internal_uuid IS NULL THEN
        RETURN FALSE;
      END IF;
      result := FALSE;
  END CASE;
  
  RETURN result;
END;
$function$;

-- Verify the function was created successfully
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'apply_history_changes' 
    AND pronargs = 11
  ) THEN
    RAISE EXCEPTION 'Failed to create apply_history_changes function';
  END IF;
  
  RAISE NOTICE 'Successfully updated apply_history_changes function with explicit table aliases';
END $$;

