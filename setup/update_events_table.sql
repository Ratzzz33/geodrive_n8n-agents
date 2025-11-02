-- Обновление таблицы events для обработки дубликатов и upsert процессора

-- Добавляем поле processed если его нет
ALTER TABLE events ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE;

-- Добавляем unique constraint для предотвращения дубликатов (если еще нет)
-- Дубликаты будут пропускаться через ON CONFLICT DO NOTHING в INSERT
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'events_branch_type_ext_id_unique'
  ) THEN
    ALTER TABLE events 
    ADD CONSTRAINT events_branch_type_ext_id_unique 
    UNIQUE (branch, type, ext_id);
  END IF;
END $$;

-- Создаем индекс для быстрого поиска непроработанных событий
CREATE INDEX IF NOT EXISTS idx_events_processed 
ON events(processed) 
WHERE processed = FALSE;

-- Комментарии
COMMENT ON COLUMN events.processed IS 'Флаг обработки события для upsert процессора';
COMMENT ON CONSTRAINT events_branch_type_ext_id_unique ON events IS 'Уникальный constraint для предотвращения дубликатов событий';

