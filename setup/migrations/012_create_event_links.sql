-- Миграция 012: Таблица связей между events, payments и history
-- Связывает одни и те же процессы из разных источников данных

CREATE TABLE IF NOT EXISTS event_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Связь с основными сущностями (через external_refs)
  entity_type TEXT NOT NULL,  -- 'car' | 'booking' | 'client' | 'payment' | 'employee'
  entity_id UUID,              -- UUID из базовых таблиц (cars, bookings, etc)
  
  -- Связи с источниками данных
  event_id BIGINT REFERENCES events(id) ON DELETE SET NULL,           -- Событие из вебхука
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,          -- Платеж
  history_id BIGINT REFERENCES history(id) ON DELETE SET NULL,         -- Запись из истории
  
  -- RentProg идентификаторы (для быстрого поиска)
  rp_entity_id TEXT,           -- ID сущности в RentProg (car_id, booking_id, payment_id)
  rp_company_id INTEGER,        -- ID филиала в RentProg
  
  -- Метаданные связи
  link_type TEXT,              -- 'webhook_to_payment' | 'history_to_payment' | 'webhook_to_history' | 'all'
  confidence TEXT,             -- 'high' | 'medium' | 'low' (уверенность в связи)
  matched_at TIMESTAMPTZ,      -- Когда была установлена связь
  matched_by TEXT,             -- 'auto' | 'manual' | 'workflow'
  
  -- Дополнительные данные
  metadata JSONB,              -- Дополнительные метаданные связи
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_event_links_entity ON event_links(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_event_links_event ON event_links(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_links_payment ON event_links(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_links_history ON event_links(history_id) WHERE history_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_links_rp ON event_links(rp_entity_id, rp_company_id);
CREATE INDEX IF NOT EXISTS idx_event_links_type ON event_links(link_type);
CREATE INDEX IF NOT EXISTS idx_event_links_confidence ON event_links(confidence);
CREATE INDEX IF NOT EXISTS idx_event_links_matched_at ON event_links(matched_at);

-- GIN индекс для JSONB поиска
CREATE INDEX IF NOT EXISTS idx_event_links_metadata_gin ON event_links USING GIN (metadata);

-- Комментарии
COMMENT ON TABLE event_links IS 'Связи между событиями (events), платежами (payments) и историей (history) - одни и те же процессы из разных источников';
COMMENT ON COLUMN event_links.entity_type IS 'Тип основной сущности: car, booking, client, payment, employee';
COMMENT ON COLUMN event_links.entity_id IS 'UUID из базовых таблиц (cars, bookings, clients, payments, employees)';
COMMENT ON COLUMN event_links.event_id IS 'ID события из таблицы events (вебхук)';
COMMENT ON COLUMN event_links.payment_id IS 'ID платежа из таблицы payments';
COMMENT ON COLUMN event_links.history_id IS 'ID записи из таблицы history';
COMMENT ON COLUMN event_links.link_type IS 'Тип связи: webhook_to_payment, history_to_payment, webhook_to_history, all (все три источника)';
COMMENT ON COLUMN event_links.confidence IS 'Уверенность в связи: high (точное совпадение по ID и времени), medium (частичное), low (предположение)';
COMMENT ON COLUMN event_links.matched_by IS 'Кто установил связь: auto (автоматически), manual (вручную), workflow (n8n workflow)';
COMMENT ON COLUMN event_links.metadata IS 'Дополнительные метаданные: время расхождения, причины связи, и т.д.';

-- View для статистики связей
CREATE OR REPLACE VIEW event_links_stats AS
SELECT 
  entity_type,
  link_type,
  confidence,
  matched_by,
  COUNT(*) as total_links,
  COUNT(DISTINCT entity_id) as unique_entities,
  COUNT(DISTINCT event_id) FILTER (WHERE event_id IS NOT NULL) as linked_events,
  COUNT(DISTINCT payment_id) FILTER (WHERE payment_id IS NOT NULL) as linked_payments,
  COUNT(DISTINCT history_id) FILTER (WHERE history_id IS NOT NULL) as linked_history,
  MIN(matched_at) as first_match,
  MAX(matched_at) as last_match
FROM event_links
GROUP BY entity_type, link_type, confidence, matched_by;

COMMENT ON VIEW event_links_stats IS 'Статистика связей между events, payments и history';

-- View для несвязанных записей
CREATE OR REPLACE VIEW unlinked_records AS
SELECT 
  'payment' as source_table,
  p.id::TEXT as record_id,
  p.branch,
  p.payment_id::TEXT as rp_id,
  p.payment_date as record_time,
  p.created_at
FROM payments p
LEFT JOIN event_links el ON el.payment_id = p.id
WHERE el.id IS NULL
  AND p.created_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT 
  'event' as source_table,
  e.id::TEXT as record_id,
  CASE 
    WHEN e.company_id = 9247 THEN 'tbilisi'
    WHEN e.company_id = 9248 THEN 'kutaisi'
    WHEN e.company_id = 9506 THEN 'batumi'
    WHEN e.company_id = 11163 THEN 'service-center'
    ELSE 'unknown'
  END as branch,
  COALESCE(e.rentprog_id, e.ext_id, '') as rp_id,
  e.ts as record_time,
  e.ts as created_at
FROM events e
LEFT JOIN event_links el ON el.event_id = e.id
WHERE el.id IS NULL
  AND e.processed = TRUE
  AND e.ts > NOW() - INTERVAL '7 days'

UNION ALL

SELECT 
  'history' as source_table,
  h.id::TEXT as record_id,
  h.branch,
  COALESCE(h.entity_id, h.operation_id, '') as rp_id,
  h.created_at as record_time,
  h.ts as created_at
FROM history h
LEFT JOIN event_links el ON el.history_id = h.id
WHERE el.id IS NULL
  AND h.processed = TRUE
  AND h.ts > NOW() - INTERVAL '7 days';

COMMENT ON VIEW unlinked_records IS 'Записи без связей за последние 7 дней';

