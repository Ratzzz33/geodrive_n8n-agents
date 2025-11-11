-- Таблица для хранения ID чатов из Umnico
CREATE TABLE IF NOT EXISTS umnico_chat_ids (
  id TEXT PRIMARY KEY,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT,
  processed BOOLEAN DEFAULT FALSE,
  last_sync_at TIMESTAMPTZ,
  metadata JSONB
);

-- Индекс для быстрого поиска необработанных
CREATE INDEX IF NOT EXISTS idx_umnico_chat_ids_processed 
ON umnico_chat_ids(processed) 
WHERE processed = FALSE;

-- Индекс для поиска по времени
CREATE INDEX IF NOT EXISTS idx_umnico_chat_ids_discovered 
ON umnico_chat_ids(discovered_at DESC);

-- Показать статистику
SELECT 
  'umnico_chat_ids' as table_name,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE processed = TRUE) as processed,
  COUNT(*) FILTER (WHERE processed = FALSE) as pending
FROM umnico_chat_ids;

