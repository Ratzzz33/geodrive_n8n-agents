-- Миграция 013: Таблица entity_timeline - денормализованный лог всех событий
-- Универсальная таблица для хранения временной линии событий по всем сущностям

CREATE TABLE IF NOT EXISTS entity_timeline (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Связь с сущностью
  entity_type TEXT NOT NULL,  -- 'car' | 'booking' | 'client' | 'employee' | 'payment' | 'branch'
  entity_id UUID NOT NULL,    -- UUID из базовых таблиц (cars, bookings, clients, etc)
  
  -- Источник события
  source_type TEXT NOT NULL,  -- 'rentprog_webhook' | 'rentprog_history' | 'starline' | 'telegram' | 'manual' | 'system'
  source_id TEXT,              -- ID из исходной таблицы (event_id, history_id, payment_id, gps_tracking_id)
  
  -- Тип события
  event_type TEXT NOT NULL,   -- 'booking.created' | 'car.gps_updated' | 'payment.received' | 'client.updated'
  operation TEXT,              -- 'create' | 'update' | 'delete' | 'move' | 'status_change'
  
  -- Данные события (денормализованные для быстрого доступа)
  summary TEXT,               -- Краткое описание: "Выдача авто клиенту Иван"
  details JSONB,              -- Детали события (зависит от типа)
  
  -- Метаданные
  branch_code TEXT,           -- Код филиала для фильтрации
  user_name TEXT,             -- Кто выполнил операцию
  confidence TEXT,            -- 'high' | 'medium' | 'low' (для автоматических событий)
  
  -- Связи с другими сущностями (для фильтрации)
  related_entities JSONB,     -- [{"type": "booking", "id": "uuid"}, {"type": "client", "id": "uuid"}]
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_entity_timeline_entity ON entity_timeline(entity_type, entity_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_entity_timeline_source ON entity_timeline(source_type, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entity_timeline_event ON entity_timeline(event_type, ts DESC);
CREATE INDEX IF NOT EXISTS idx_entity_timeline_branch ON entity_timeline(branch_code, ts DESC) WHERE branch_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entity_timeline_ts ON entity_timeline(ts DESC);
CREATE INDEX IF NOT EXISTS idx_entity_timeline_operation ON entity_timeline(operation) WHERE operation IS NOT NULL;

-- GIN индекс для JSONB поиска
CREATE INDEX IF NOT EXISTS idx_entity_timeline_related_gin ON entity_timeline USING GIN (related_entities);
CREATE INDEX IF NOT EXISTS idx_entity_timeline_details_gin ON entity_timeline USING GIN (details);

-- Композитный индекс для частых запросов (сущность + время)
CREATE INDEX IF NOT EXISTS idx_entity_timeline_entity_ts ON entity_timeline(entity_type, entity_id, ts DESC);

-- Комментарии
COMMENT ON TABLE entity_timeline IS 'Денормализованный лог всех событий по сущностям - единая временная линия для оркестратора и агентов';
COMMENT ON COLUMN entity_timeline.entity_type IS 'Тип сущности: car, booking, client, employee, payment, branch';
COMMENT ON COLUMN entity_timeline.entity_id IS 'UUID из базовых таблиц (cars, bookings, clients, employees, payments, branches)';
COMMENT ON COLUMN entity_timeline.source_type IS 'Источник события: rentprog_webhook, rentprog_history, starline, telegram, manual, system';
COMMENT ON COLUMN entity_timeline.source_id IS 'ID из исходной таблицы (event_id, history_id, payment_id, gps_tracking_id)';
COMMENT ON COLUMN entity_timeline.event_type IS 'Тип события: booking.created, car.gps_updated, payment.received, client.updated и т.д.';
COMMENT ON COLUMN entity_timeline.operation IS 'Операция: create, update, delete, move, status_change';
COMMENT ON COLUMN entity_timeline.summary IS 'Краткое описание события для быстрого просмотра';
COMMENT ON COLUMN entity_timeline.details IS 'Детали события в формате JSONB (зависит от типа события)';
COMMENT ON COLUMN entity_timeline.related_entities IS 'Массив связанных сущностей: [{"type": "booking", "id": "uuid"}, ...]';

-- View для статистики по типам событий
CREATE OR REPLACE VIEW entity_timeline_stats AS
SELECT 
  entity_type,
  event_type,
  source_type,
  operation,
  COUNT(*) as total_events,
  COUNT(DISTINCT entity_id) as unique_entities,
  MIN(ts) as first_event,
  MAX(ts) as last_event
FROM entity_timeline
GROUP BY entity_type, event_type, source_type, operation
ORDER BY total_events DESC;

COMMENT ON VIEW entity_timeline_stats IS 'Статистика событий в timeline по типам';

-- View для последних событий по сущности
CREATE OR REPLACE VIEW entity_timeline_recent AS
SELECT DISTINCT ON (entity_type, entity_id)
  entity_type,
  entity_id,
  ts,
  event_type,
  summary,
  source_type,
  branch_code
FROM entity_timeline
ORDER BY entity_type, entity_id, ts DESC;

COMMENT ON VIEW entity_timeline_recent IS 'Последнее событие для каждой сущности';

-- Функция для автоматической очистки старых записей (опционально)
CREATE OR REPLACE FUNCTION cleanup_old_timeline_entries(retention_days INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM entity_timeline
  WHERE ts < NOW() - (retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_timeline_entries IS 'Очистка старых записей timeline (по умолчанию старше 1 года)';

