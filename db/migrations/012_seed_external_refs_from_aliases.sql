BEGIN;

INSERT INTO external_refs (entity_type, entity_id, system, external_id, data)
SELECT DISTINCT
  'payment',
  p.id,
  'car',
  c.id::text,
  jsonb_build_object('source_table','payments','source_column','car_id')
FROM payments p
JOIN cars c ON c.id::text = p.car_id::text
WHERE p.car_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM external_refs er
    WHERE er.entity_type = 'payment'
      AND er.entity_id = p.id
      AND er.system = 'car'
      AND er.external_id = c.id::text
  );

INSERT INTO external_refs (entity_type, entity_id, system, external_id, data)
SELECT DISTINCT
  'payment',
  p.id,
  'client',
  cl.id::text,
  jsonb_build_object('source_table','payments','source_column','client_id')
FROM payments p
JOIN clients cl ON cl.id::text = p.client_id::text
WHERE p.client_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM external_refs er
    WHERE er.entity_type = 'payment'
      AND er.entity_id = p.id
      AND er.system = 'client'
      AND er.external_id = cl.id::text
  );

INSERT INTO external_refs (entity_type, entity_id, system, external_id, data)
SELECT DISTINCT
  'payment',
  p.id,
  'employee',
  e.id::text,
  jsonb_build_object('source_table','payments','source_column','user_id')
FROM payments p
JOIN employees e ON e.id::text = p.user_id::text
WHERE p.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM external_refs er
    WHERE er.entity_type = 'payment'
      AND er.entity_id = p.id
      AND er.system = 'employee'
      AND er.external_id = e.id::text
  );

COMMIT;

