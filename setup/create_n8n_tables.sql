-- Таблицы для мониторинга n8n

-- События вебхуков RentProg
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  branch TEXT,
  type TEXT,
  ext_id TEXT,
  ok BOOLEAN DEFAULT TRUE,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_branch ON events(branch);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);

-- Прогресс синхронизации
CREATE TABLE IF NOT EXISTS sync_runs (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  branch TEXT,
  entity TEXT,        -- 'car'|'client'|'booking'
  page INT DEFAULT 0,
  added INT DEFAULT 0,
  updated INT DEFAULT 0,
  ok BOOLEAN DEFAULT TRUE,
  msg TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_ts ON sync_runs(ts);
CREATE INDEX IF NOT EXISTS idx_sync_runs_branch ON sync_runs(branch);
CREATE INDEX IF NOT EXISTS idx_sync_runs_entity ON sync_runs(entity);

-- Health check статусы
CREATE TABLE IF NOT EXISTS health (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  branch TEXT,
  ok BOOLEAN,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_health_ts ON health(ts);
CREATE INDEX IF NOT EXISTS idx_health_branch ON health(branch);

