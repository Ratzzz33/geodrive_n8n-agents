BEGIN;

CREATE INDEX IF NOT EXISTS external_refs_entity_idx
  ON external_refs (entity_type, entity_id);

COMMIT;

