BEGIN;

-- Переносим rp_payment_id из payments в external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id, data)
SELECT DISTINCT
  'payment',
  p.id,
  'rentprog_payment',
  p.rp_payment_id::text,
  jsonb_build_object('source_table','payments','source_column','rp_payment_id')
FROM payments p
WHERE p.rp_payment_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM external_refs er
    WHERE er.entity_type = 'payment'
      AND er.entity_id = p.id
      AND er.system = 'rentprog_payment'
      AND er.external_id = p.rp_payment_id::text
  )
ON CONFLICT ON CONSTRAINT external_refs_system_external_unique DO NOTHING;

-- Переносим rp_car_id из payments в external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id, data)
SELECT DISTINCT
  'payment',
  p.id,
  'rentprog_car',
  p.rp_car_id::text,
  jsonb_build_object('source_table','payments','source_column','rp_car_id')
FROM payments p
WHERE p.rp_car_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM external_refs er
    WHERE er.entity_type = 'payment'
      AND er.entity_id = p.id
      AND er.system = 'rentprog_car'
      AND er.external_id = p.rp_car_id::text
  )
ON CONFLICT ON CONSTRAINT external_refs_system_external_unique DO NOTHING;

-- Переносим rp_client_id из payments в external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id, data)
SELECT DISTINCT
  'payment',
  p.id,
  'rentprog_client',
  p.rp_client_id::text,
  jsonb_build_object('source_table','payments','source_column','rp_client_id')
FROM payments p
WHERE p.rp_client_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM external_refs er
    WHERE er.entity_type = 'payment'
      AND er.entity_id = p.id
      AND er.system = 'rentprog_client'
      AND er.external_id = p.rp_client_id::text
  )
ON CONFLICT ON CONSTRAINT external_refs_system_external_unique DO NOTHING;

-- Переносим rp_user_id из payments в external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id, data)
SELECT DISTINCT
  'payment',
  p.id,
  'rentprog_user',
  p.rp_user_id::text,
  jsonb_build_object('source_table','payments','source_column','rp_user_id')
FROM payments p
WHERE p.rp_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM external_refs er
    WHERE er.entity_type = 'payment'
      AND er.entity_id = p.id
      AND er.system = 'rentprog_user'
      AND er.external_id = p.rp_user_id::text
  )
ON CONFLICT ON CONSTRAINT external_refs_system_external_unique DO NOTHING;

-- Переносим rp_company_id из payments в external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id, data)
SELECT DISTINCT
  'payment',
  p.id,
  'rentprog_company',
  p.rp_company_id::text,
  jsonb_build_object('source_table','payments','source_column','rp_company_id')
FROM payments p
WHERE p.rp_company_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM external_refs er
    WHERE er.entity_type = 'payment'
      AND er.entity_id = p.id
      AND er.system = 'rentprog_company'
      AND er.external_id = p.rp_company_id::text
  )
ON CONFLICT ON CONSTRAINT external_refs_system_external_unique DO NOTHING;

-- Переносим rp_cashbox_id из payments в external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id, data)
SELECT DISTINCT
  'payment',
  p.id,
  'rentprog_cashbox',
  p.rp_cashbox_id::text,
  jsonb_build_object('source_table','payments','source_column','rp_cashbox_id')
FROM payments p
WHERE p.rp_cashbox_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM external_refs er
    WHERE er.entity_type = 'payment'
      AND er.entity_id = p.id
      AND er.system = 'rentprog_cashbox'
      AND er.external_id = p.rp_cashbox_id::text
  )
ON CONFLICT ON CONSTRAINT external_refs_system_external_unique DO NOTHING;

-- Переносим rp_category_id из payments в external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id, data)
SELECT DISTINCT
  'payment',
  p.id,
  'rentprog_category',
  p.rp_category_id::text,
  jsonb_build_object('source_table','payments','source_column','rp_category_id')
FROM payments p
WHERE p.rp_category_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM external_refs er
    WHERE er.entity_type = 'payment'
      AND er.entity_id = p.id
      AND er.system = 'rentprog_category'
      AND er.external_id = p.rp_category_id::text
  )
ON CONFLICT ON CONSTRAINT external_refs_system_external_unique DO NOTHING;

-- Переносим rp_subcategory_id из payments в external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id, data)
SELECT DISTINCT
  'payment',
  p.id,
  'rentprog_subcategory',
  p.rp_subcategory_id::text,
  jsonb_build_object('source_table','payments','source_column','rp_subcategory_id')
FROM payments p
WHERE p.rp_subcategory_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM external_refs er
    WHERE er.entity_type = 'payment'
      AND er.entity_id = p.id
      AND er.system = 'rentprog_subcategory'
      AND er.external_id = p.rp_subcategory_id::text
  )
ON CONFLICT ON CONSTRAINT external_refs_system_external_unique DO NOTHING;

COMMIT;

