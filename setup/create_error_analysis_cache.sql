-- Таблица для кэширования AI-анализа ошибок n8n
-- Позволяет не тратить токены на одинаковые ошибки

CREATE TABLE IF NOT EXISTS error_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_hash VARCHAR(64) UNIQUE NOT NULL,
  
  -- Информация об ошибке
  workflow_id TEXT,
  workflow_name TEXT,
  node_name TEXT,
  error_message TEXT,
  error_type VARCHAR(50),  -- 'database', 'api', 'typescript', 'simple', etc.
  
  -- AI анализ
  ai_model_used VARCHAR(50),
  ai_analysis TEXT,
  cursor_prompt TEXT,
  estimated_cost DECIMAL(10, 6),
  
  -- Статистика использования
  occurrence_count INTEGER DEFAULT 1,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  
  -- Мета
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_error_analysis_cache_hash ON error_analysis_cache(error_hash);
CREATE INDEX IF NOT EXISTS idx_error_analysis_cache_created ON error_analysis_cache(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_analysis_cache_workflow ON error_analysis_cache(workflow_id);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_error_analysis_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автообновления updated_at
DROP TRIGGER IF EXISTS trigger_update_error_analysis_cache_updated_at ON error_analysis_cache;
CREATE TRIGGER trigger_update_error_analysis_cache_updated_at
  BEFORE UPDATE ON error_analysis_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_error_analysis_cache_updated_at();

COMMENT ON TABLE error_analysis_cache IS 'Кэш AI-анализа ошибок n8n для экономии токенов';
COMMENT ON COLUMN error_analysis_cache.error_hash IS 'SHA-256 hash нормализованной ошибки для дедупликации';
COMMENT ON COLUMN error_analysis_cache.occurrence_count IS 'Сколько раз встречалась эта ошибка';
COMMENT ON COLUMN error_analysis_cache.cursor_prompt IS 'Готовый промпт для копирования в Cursor';

