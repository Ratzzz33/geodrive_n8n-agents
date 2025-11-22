-- ============================================
-- Миграция: Таблицы для хранения контента сайта geodrive.info
-- Дата: 2025-01-XX
-- Назначение: Хранение контента сайта для обучения агента по созданию нового сайта
-- ============================================

-- Расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Таблица страниц сайта
CREATE TABLE IF NOT EXISTS website_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- URL и метаданные
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  description TEXT,
  meta_keywords TEXT,
  
  -- Контент
  html_content TEXT,
  text_content TEXT,              -- Очищенный текст без HTML
  main_content TEXT,               -- Основной контент страницы (без header/footer)
  
  -- Структура
  headings JSONB DEFAULT '[]'::jsonb,  -- [{level: 1, text: '...'}, ...]
  links JSONB DEFAULT '[]'::jsonb,     -- [{url: '...', text: '...'}, ...]
  images JSONB DEFAULT '[]'::jsonb,     -- [{url: '...', alt: '...'}, ...]
  
  -- Метаданные
  language TEXT DEFAULT 'ru',
  page_type TEXT,                  -- 'home' | 'about' | 'services' | 'contact' | 'blog' | etc.
  section TEXT,                     -- Раздел сайта
  
  -- Временные метки
  scraped_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Дополнительные данные
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_website_pages_url ON website_pages(url);
CREATE INDEX idx_website_pages_type ON website_pages(page_type);
CREATE INDEX idx_website_pages_section ON website_pages(section);
CREATE INDEX idx_website_pages_scraped ON website_pages(scraped_at DESC);

-- Таблица чанков контента (для RAG)
CREATE TABLE IF NOT EXISTS website_content_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES website_pages(id) ON DELETE CASCADE,
  
  -- Контент чанка
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,     -- Порядковый номер чанка на странице
  
  -- Метаданные чанка
  chunk_type TEXT,                  -- 'heading' | 'paragraph' | 'list' | 'table' | 'code'
  section_context TEXT,             -- Контекст раздела (например, "Услуги > Аренда авто")
  
  -- Эмбеддинг
  embedding vector(1536),           -- OpenAI text-embedding-3-small (1536 размерность)
  
  -- Временные метки
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_chunk_type CHECK (chunk_type IN ('heading', 'paragraph', 'list', 'table', 'code', 'other'))
);

CREATE INDEX idx_chunks_page ON website_content_chunks(page_id);
CREATE INDEX idx_chunks_index ON website_content_chunks(page_id, chunk_index);
CREATE INDEX idx_chunks_type ON website_content_chunks(chunk_type);

-- Векторный индекс для поиска (ivfflat для pgvector)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON website_content_chunks 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- Таблица для отслеживания процесса парсинга
CREATE TABLE IF NOT EXISTS website_scraping_log (
  id BIGSERIAL PRIMARY KEY,
  
  -- Статус
  url TEXT NOT NULL,
  status TEXT NOT NULL,             -- 'pending' | 'success' | 'error' | 'skipped'
  error_message TEXT,
  
  -- Статистика
  pages_found INTEGER DEFAULT 0,
  chunks_created INTEGER DEFAULT 0,
  
  -- Временные метки
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  
  -- Метаданные
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_scraping_log_url ON website_scraping_log(url);
CREATE INDEX idx_scraping_log_status ON website_scraping_log(status);
CREATE INDEX idx_scraping_log_started ON website_scraping_log(started_at DESC);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_website_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_website_pages_updated_at 
  BEFORE UPDATE ON website_pages
  FOR EACH ROW 
  EXECUTE FUNCTION update_website_pages_updated_at();

-- Представление для удобного поиска контента
CREATE OR REPLACE VIEW website_content_search AS
SELECT 
  p.id AS page_id,
  p.url,
  p.title,
  p.page_type,
  p.section,
  c.id AS chunk_id,
  c.chunk_index,
  c.content,
  c.chunk_type,
  c.section_context,
  c.embedding,
  p.scraped_at
FROM website_pages p
JOIN website_content_chunks c ON p.id = c.page_id
ORDER BY p.url, c.chunk_index;

COMMENT ON VIEW website_content_search IS 'Удобное представление для поиска контента сайта';

-- ============================================
-- Конец миграции
-- ============================================

