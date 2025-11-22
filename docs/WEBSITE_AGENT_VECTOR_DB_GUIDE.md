# Руководство по использованию векторной БД для AI агента создания сайта Geodrive

## 📋 Содержание

1. [Обзор](#обзор)
2. [Структура данных](#структура-данных)
3. [Semantic Search (поиск похожего контента)](#semantic-search)
4. [Интеграция с AI агентом](#интеграция-с-ai-агентом)
5. [Примеры использования](#примеры-использования)
6. [Best Practices](#best-practices)

---

## 🎯 Обзор

Векторная БД содержит весь контент сайта geodrive.info, разбитый на чанки с векторными представлениями (эмбеддингами). Это позволяет AI агенту:

- **Находить релевантный контент** по смыслу, а не только по ключевым словам
- **Использовать существующий стиль и структуру** при создании нового контента
- **Сохранять консистентность** между старым и новым сайтом
- **Генерировать контент** на основе реальных данных компании

---

## 📊 Структура данных

### Таблицы

#### 1. `website_pages` - Страницы сайта

```sql
CREATE TABLE website_pages (
  id UUID PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  title TEXT,
  description TEXT,
  text_content TEXT,              -- Очищенный текст
  main_content TEXT,               -- Основной контент
  headings JSONB,                  -- [{level: 1, text: '...'}, ...]
  links JSONB,                     -- [{url: '...', text: '...'}, ...]
  images JSONB,                    -- [{url: '...', alt: '...'}, ...]
  page_type TEXT,                  -- 'home' | 'about' | 'services' | etc.
  scraped_at TIMESTAMPTZ
);
```

#### 2. `website_content_chunks` - Чанки с эмбеддингами

```sql
CREATE TABLE website_content_chunks (
  id UUID PRIMARY KEY,
  page_id UUID REFERENCES website_pages(id),
  content TEXT NOT NULL,           -- Текст чанка (~1000 символов)
  chunk_index INTEGER,              -- Порядковый номер на странице
  chunk_type TEXT,                 -- 'heading' | 'paragraph' | 'list' | etc.
  embedding vector(1536),          -- OpenAI text-embedding-3-small
  created_at TIMESTAMPTZ
);
```

#### 3. `website_content_search` - Представление для удобного поиска

```sql
CREATE VIEW website_content_search AS
SELECT 
  p.id AS page_id,
  p.url,
  p.title,
  p.page_type,
  c.id AS chunk_id,
  c.chunk_index,
  c.content,
  c.chunk_type,
  c.embedding
FROM website_pages p
JOIN website_content_chunks c ON p.id = c.page_id;
```

---

## 🔍 Semantic Search

### Базовый поиск похожего контента

Для semantic search нужно:
1. Создать эмбеддинг для вашего запроса через OpenAI API
2. Использовать его для поиска похожих чанков

#### Шаг 1: Создать эмбеддинг запроса

```javascript
// Пример на Node.js
import fetch from 'node-fetch';

async function createQueryEmbedding(query) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: query
    })
  });
  
  const data = await response.json();
  return data.data[0].embedding;
}

const queryEmbedding = await createQueryEmbedding('аренда автомобиля в Тбилиси');
```

#### Шаг 2: Поиск похожих чанков

```sql
-- Поиск топ-10 самых похожих чанков
SELECT 
  p.url,
  p.title,
  p.page_type,
  c.content,
  c.chunk_type,
  1 - (c.embedding <=> $1::vector) AS similarity
FROM website_content_chunks c
JOIN website_pages p ON c.page_id = p.id
WHERE c.embedding IS NOT NULL
ORDER BY similarity DESC
LIMIT 10;
```

**Оператор `<=>`** - это cosine distance в pgvector.  
**`1 - distance`** дает similarity (0-1, где 1 = идентично).

---

## 🤖 Интеграция с AI агентом

### Вариант 1: n8n AI Agent с Vector Store

#### Настройка Vector Store в n8n

1. **Создайте Vector Store ноду:**
   - Тип: `Supabase Vector Store` или `Simple Vector Store`
   - Для PostgreSQL с pgvector используйте кастомный подход

2. **Подключите к AI Agent:**
   ```
   AI Agent → Vector Store (ai_tool)
   ```

3. **Используйте в workflow:**
   - AI Agent автоматически будет искать релевантный контент
   - Используйте найденный контент как контекст для генерации

#### Пример workflow:

```
Webhook (запрос на создание страницы)
  ↓
AI Agent
  ├─ Vector Store Tool (поиск похожего контента)
  ├─ HTTP Request Tool (получение данных из БД)
  └─ Code Tool (обработка данных)
  ↓
Respond to Webhook (сгенерированный контент)
```

### Вариант 2: Прямой SQL запрос + LLM

#### Шаг 1: Поиск релевантного контента

```javascript
// Node.js пример
import postgres from 'postgres';
import { createQueryEmbedding } from './embeddings.js';

const sql = postgres(CONNECTION_STRING);

async function findRelevantContent(query, limit = 5) {
  // Создать эмбеддинг запроса
  const queryEmbedding = await createQueryEmbedding(query);
  
  // Поиск похожих чанков
  const results = await sql`
    SELECT 
      p.url,
      p.title,
      p.page_type,
      c.content,
      1 - (c.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) AS similarity
    FROM website_content_chunks c
    JOIN website_pages p ON c.page_id = p.id
    WHERE c.embedding IS NOT NULL
    ORDER BY similarity DESC
    LIMIT ${limit}
  `;
  
  return results;
}

// Использование
const relevantContent = await findRelevantContent(
  'условия аренды автомобиля в Грузии',
  5
);
```

#### Шаг 2: Использование в промпте для LLM

```javascript
const context = relevantContent
  .map(r => `[${r.title}] ${r.content}`)
  .join('\n\n');

const prompt = `
Создай новый контент для страницы "Условия аренды" на основе следующего контекста:

${context}

Требования:
- Сохрани стиль и тон существующего контента
- Используй структуру похожих страниц
- Добавь актуальную информацию
`;
```

---

## 💡 Примеры использования

### Пример 1: Создание новой страницы на основе существующей

```sql
-- Найти похожие страницы по типу
SELECT 
  url,
  title,
  headings,
  main_content
FROM website_pages
WHERE page_type = 'services'
ORDER BY scraped_at DESC
LIMIT 3;
```

**Использование в AI агенте:**
```
Запрос: "Создай страницу 'Аренда внедорожников' в стиле существующих страниц услуг"

1. AI Agent находит похожие страницы через semantic search
2. Анализирует структуру (headings, формат)
3. Генерирует новый контент в том же стиле
```

### Пример 2: Поиск информации для FAQ

```sql
-- Найти контент, связанный с вопросами
SELECT 
  p.url,
  p.title,
  c.content,
  1 - (c.embedding <=> $query_embedding::vector) AS similarity
FROM website_content_chunks c
JOIN website_pages p ON c.page_id = p.id
WHERE c.embedding IS NOT NULL
  AND (p.page_type = 'faq' OR c.content ILIKE '%вопрос%' OR c.content ILIKE '%ответ%')
ORDER BY similarity DESC
LIMIT 10;
```

### Пример 3: Генерация мета-описаний

```sql
-- Получить все страницы без описаний
SELECT 
  url,
  title,
  text_content
FROM website_pages
WHERE description IS NULL OR description = ''
ORDER BY scraped_at DESC;
```

**AI Agent может:**
1. Найти похожие страницы с описаниями
2. Проанализировать стиль описаний
3. Сгенерировать описания для новых страниц

### Пример 4: Проверка консистентности стиля

```sql
-- Найти все заголовки определенного уровня
SELECT 
  p.url,
  p.title,
  h->>'text' as heading_text,
  (h->>'level')::int as level
FROM website_pages p,
  jsonb_array_elements(p.headings) h
WHERE (h->>'level')::int = 1  -- H1 заголовки
ORDER BY p.scraped_at DESC;
```

---

## 🎨 Best Practices

### 1. Используйте фильтры для точности

```sql
-- Поиск только в определенном типе страниц
SELECT 
  p.url,
  c.content,
  1 - (c.embedding <=> $embedding::vector) AS similarity
FROM website_content_chunks c
JOIN website_pages p ON c.page_id = p.id
WHERE c.embedding IS NOT NULL
  AND p.page_type = 'services'  -- Только страницы услуг
  AND similarity > 0.7          -- Минимальная схожесть
ORDER BY similarity DESC
LIMIT 10;
```

### 2. Комбинируйте semantic search с текстовым поиском

```sql
-- Semantic search + текстовый фильтр
SELECT 
  p.url,
  c.content,
  1 - (c.embedding <=> $embedding::vector) AS similarity
FROM website_content_chunks c
JOIN website_pages p ON c.page_id = p.id
WHERE c.embedding IS NOT NULL
  AND c.content ILIKE '%аренда%'  -- Текстовый фильтр
ORDER BY similarity DESC
LIMIT 10;
```

### 3. Используйте контекст страницы

```sql
-- Получить все чанки со страницы для полного контекста
SELECT 
  c.chunk_index,
  c.chunk_type,
  c.content
FROM website_content_chunks c
WHERE c.page_id = $page_id
ORDER BY c.chunk_index;
```

### 4. Оптимизация запросов

```sql
-- Создайте индекс для быстрого поиска (уже создан)
CREATE INDEX idx_chunks_embedding ON website_content_chunks 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- Используйте LIMIT для производительности
-- Рекомендуется: LIMIT 5-10 для контекста, LIMIT 20-50 для анализа
```

### 5. Обработка результатов

```javascript
// Пример обработки результатов semantic search
function formatContextForLLM(results) {
  return results
    .filter(r => r.similarity > 0.7)  // Только релевантные
    .map((r, i) => {
      return `[Контекст ${i + 1} - ${r.title}]\n${r.content}`;
    })
    .join('\n\n---\n\n');
}

const context = formatContextForLLM(relevantContent);
```

---

## 🔧 Практические примеры для AI агента

### Сценарий 1: Создание новой страницы услуги

```javascript
async function generateServicePage(serviceName) {
  // 1. Найти похожие страницы услуг
  const query = `услуга ${serviceName} аренда автомобиля`;
  const similarPages = await findRelevantContent(query, 5);
  
  // 2. Извлечь структуру
  const structure = similarPages.map(p => ({
    title: p.title,
    headings: p.headings,
    url: p.url
  }));
  
  // 3. Сформировать промпт для LLM
  const prompt = `
Создай контент для страницы "${serviceName}" на основе следующих примеров:

${structure.map(s => `- ${s.title}: ${s.url}`).join('\n')}

Требования:
- Используй похожую структуру заголовков
- Сохрани стиль и тон
- Добавь уникальную информацию о ${serviceName}
`;
  
  // 4. Отправить в LLM
  return await callLLM(prompt);
}
```

### Сценарий 2: Обновление существующей страницы

```javascript
async function updatePageContent(pageUrl, newRequirements) {
  // 1. Найти текущий контент страницы
  const currentPage = await sql`
    SELECT * FROM website_pages WHERE url = ${pageUrl}
  `;
  
  // 2. Найти похожий контент для обновления
  const relevantContent = await findRelevantContent(
    `${newRequirements} ${currentPage.title}`,
    3
  );
  
  // 3. Сформировать промпт
  const prompt = `
Обнови контент страницы "${currentPage.title}":

Текущий контент:
${currentPage.main_content}

Новые требования:
${newRequirements}

Похожий контент для справки:
${relevantContent.map(r => r.content).join('\n\n')}

Обнови контент, сохранив стиль и структуру.
`;
  
  return await callLLM(prompt);
}
```

### Сценарий 3: Генерация SEO мета-тегов

```javascript
async function generateMetaTags(pageUrl) {
  const page = await sql`
    SELECT title, text_content, page_type
    FROM website_pages
    WHERE url = ${pageUrl}
  `;
  
  // Найти похожие страницы с хорошими описаниями
  const similarPages = await findRelevantContent(
    page.text_content.substring(0, 200),
    5
  );
  
  const examples = similarPages
    .filter(p => p.description)
    .map(p => `Title: ${p.title}\nDescription: ${p.description}`)
    .join('\n\n');
  
  const prompt = `
Создай SEO мета-теги для страницы:

Заголовок: ${page.title}
Контент: ${page.text_content.substring(0, 500)}

Примеры хороших мета-тегов:
${examples}

Создай:
- Title (50-60 символов)
- Description (150-160 символов)
- Keywords (5-10 ключевых слов)
`;
  
  return await callLLM(prompt);
}
```

---

## 📝 SQL функции для удобства

### Функция поиска похожего контента

```sql
CREATE OR REPLACE FUNCTION find_similar_content(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.7,
  max_results int DEFAULT 10,
  page_type_filter text DEFAULT NULL
)
RETURNS TABLE (
  url text,
  title text,
  content text,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.url,
    p.title,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM website_content_chunks c
  JOIN website_pages p ON c.page_id = p.id
  WHERE c.embedding IS NOT NULL
    AND (page_type_filter IS NULL OR p.page_type = page_type_filter)
    AND (1 - (c.embedding <=> query_embedding)) > similarity_threshold
  ORDER BY similarity DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;
```

**Использование:**
```sql
SELECT * FROM find_similar_content(
  $1::vector(1536),  -- эмбеддинг запроса
  0.7,               -- минимальная схожесть
  10,                -- максимум результатов
  'services'         -- фильтр по типу страницы
);
```

---

## 🚀 Интеграция с n8n AI Agent

### Пример workflow для генерации контента

```json
{
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "generate-page",
        "httpMethod": "POST"
      }
    },
    {
      "name": "Create Query Embedding",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "https://api.openai.com/v1/embeddings",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "Bearer {{ $env.OPENAI_API_KEY }}"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "model",
              "value": "text-embedding-3-small"
            },
            {
              "name": "input",
              "value": "={{ $json.body.query }}"
            }
          ]
        }
      }
    },
    {
      "name": "Search Vector DB",
      "type": "n8n-nodes-base.postgres",
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT p.url, p.title, c.content, 1 - (c.embedding <=> $1::vector) AS similarity FROM website_content_chunks c JOIN website_pages p ON c.page_id = p.id WHERE c.embedding IS NOT NULL ORDER BY similarity DESC LIMIT 5"
      }
    },
    {
      "name": "AI Agent",
      "type": "@n8n/n8n-nodes-langchain.agent",
      "parameters": {
        "systemMessage": "Ты AI агент для создания контента сайта Geodrive. Используй найденный контент как референс для сохранения стиля и структуры."
      }
    }
  ]
}
```

---

## 📚 Дополнительные ресурсы

- **pgvector документация:** https://github.com/pgvector/pgvector
- **OpenAI Embeddings API:** https://platform.openai.com/docs/guides/embeddings
- **n8n AI Agent:** https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/

---

## ✅ Checklist для использования

- [ ] Эмбеддинги созданы для всех чанков
- [ ] Векторный индекс создан и оптимизирован
- [ ] Функция поиска протестирована
- [ ] AI Agent настроен с доступом к векторной БД
- [ ] Промпты оптимизированы для использования контекста
- [ ] Система мониторинга качества результатов настроена

---

**Готово!** Теперь ваш AI агент может использовать весь контент старого сайта для создания нового, сохраняя стиль и структуру.

