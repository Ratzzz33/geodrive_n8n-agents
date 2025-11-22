BEGIN;

-- Переносим tg_chat_id из tasks в external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id, data)
SELECT DISTINCT
  'task',
  t.id,
  'telegram_chat',
  t.tg_chat_id::text,
  jsonb_build_object('source_table','tasks','source_column','tg_chat_id')
FROM tasks t
WHERE t.tg_chat_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM external_refs er
    WHERE er.entity_type = 'task'
      AND er.entity_id = t.id
      AND er.system = 'telegram_chat'
      AND er.external_id = t.tg_chat_id::text
  )
ON CONFLICT ON CONSTRAINT external_refs_system_external_unique DO NOTHING;

-- Переносим tg_topic_id из tasks в external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id, data)
SELECT DISTINCT
  'task',
  t.id,
  'telegram_topic',
  t.tg_topic_id::text,
  jsonb_build_object('source_table','tasks','source_column','tg_topic_id')
FROM tasks t
WHERE t.tg_topic_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM external_refs er
    WHERE er.entity_type = 'task'
      AND er.entity_id = t.id
      AND er.system = 'telegram_topic'
      AND er.external_id = t.tg_topic_id::text
  )
ON CONFLICT ON CONSTRAINT external_refs_system_external_unique DO NOTHING;

COMMIT;

