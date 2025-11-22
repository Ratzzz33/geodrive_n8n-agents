BEGIN;

-- Удаляем индексы для Telegram колонок (если есть)
DROP INDEX IF EXISTS idx_tasks_tg_chat_id;
DROP INDEX IF EXISTS idx_tasks_tg_topic_id;

-- Удаляем колонки tg_chat_id и tg_topic_id из tasks
-- Данные уже перенесены в external_refs через миграцию 014
ALTER TABLE tasks
  DROP COLUMN IF EXISTS tg_chat_id,
  DROP COLUMN IF EXISTS tg_topic_id;

COMMIT;

