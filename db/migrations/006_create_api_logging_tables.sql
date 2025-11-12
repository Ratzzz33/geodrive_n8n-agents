-- Таблица метаданных endpoints
CREATE TABLE IF NOT EXISTS api_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL,
  method TEXT NOT NULL, -- GET, POST, PUT, DELETE, PATCH
  status TEXT NOT NULL DEFAULT 'active', -- active, deprecated, disabled
  description TEXT,
  category TEXT, -- health, sync, webhook, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(path, method)
);

CREATE INDEX idx_api_endpoints_path ON api_endpoints(path);
CREATE INDEX idx_api_endpoints_method ON api_endpoints(method);
CREATE INDEX idx_api_endpoints_status ON api_endpoints(status);

-- Таблица логов запросов
CREATE TABLE IF NOT EXISTS api_request_logs (
  id BIGSERIAL PRIMARY KEY,
  endpoint_id UUID REFERENCES api_endpoints(id) ON DELETE SET NULL,
  path TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INT,
  request_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_ms INT, -- время выполнения в миллисекундах
  ip_address INET,
  user_agent TEXT,
  request_size_bytes INT,
  response_size_bytes INT,
  error_message TEXT,
  request_body JSONB, -- опционально, для отладки
  response_body JSONB, -- опционально, только для ошибок
  metadata JSONB -- дополнительные данные
);

CREATE INDEX idx_api_request_logs_endpoint_id ON api_request_logs(endpoint_id);
CREATE INDEX idx_api_request_logs_path ON api_request_logs(path);
CREATE INDEX idx_api_request_logs_method ON api_request_logs(method);
CREATE INDEX idx_api_request_logs_request_time ON api_request_logs(request_time);
CREATE INDEX idx_api_request_logs_status_code ON api_request_logs(status_code);

-- Автоматическое обновление updated_at
CREATE OR REPLACE FUNCTION update_api_endpoints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER api_endpoints_updated_at
  BEFORE UPDATE ON api_endpoints
  FOR EACH ROW
  EXECUTE FUNCTION update_api_endpoints_updated_at();

