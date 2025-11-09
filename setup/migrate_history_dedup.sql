-- Миграция: улучшение дедупликации в таблице history
-- Дата: 2025-11-08
-- Цель: использовать operation_id вместо (operation_type, created_at, entity_id) для дедупликации

-- 1. Удалить старый constraint (если есть)
ALTER TABLE history 
DROP CONSTRAINT IF EXISTS history_branch_operation_type_created_at_entity_id_key;

-- 2. Создать новый UNIQUE constraint на (branch, operation_id)
-- operation_id уникален внутри филиала и всегда присутствует
CREATE UNIQUE INDEX IF NOT EXISTS history_branch_operation_id_unique
  ON history (branch, operation_id)
  WHERE operation_id IS NOT NULL;

-- 3. Создать индекс для быстрого поиска по operation_id
CREATE INDEX IF NOT EXISTS idx_history_operation_id 
  ON history (operation_id)
  WHERE operation_id IS NOT NULL;

-- Комментарии
COMMENT ON COLUMN history.operation_id IS 'ID операции из RentProg API (уникален внутри филиала)';

-- Примечание: 
-- Старый constraint (branch, operation_type, created_at, entity_id) имел проблему:
-- - entity_id часто NULL
-- - NULL != NULL в UNIQUE constraint
-- - Создавались дубли для операций без entity_id
-- 
-- Новый constraint (branch, operation_id):
-- - operation_id всегда есть (не NULL)
-- - operation_id уникален в RentProg
-- - Никаких дублей!

