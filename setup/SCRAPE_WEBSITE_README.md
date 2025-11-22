# Парсинг сайта geodrive.info

## Описание

Скрипт для парсинга сайта geodrive.info и сохранения контента в векторную БД для обучения агента по созданию нового сайта.

## Структура

### Таблицы БД

1. **website_pages** - страницы сайта
   - URL, заголовок, описание
   - HTML и текстовый контент
   - Заголовки, ссылки, изображения
   - Тип страницы (home, about, services, etc.)

2. **website_content_chunks** - чанки контента для RAG
   - Разбивка текста на части по ~1000 символов
   - Эмбеддинги (vector 1536) через OpenAI API
   - Тип чанка (heading, paragraph, list, etc.)

3. **website_scraping_log** - лог процесса парсинга
   - Статус парсинга
   - Статистика (страниц, чанков)

## Использование

### 1. Применить миграцию БД

```bash
node setup/apply_website_schema.mjs
```

### 2. Запустить парсинг

```bash
# Установить OPENAI_API_KEY (опционально, для эмбеддингов)
export OPENAI_API_KEY="your-key"

# Запустить парсинг
node setup/scrape_geodrive_website.mjs
```

**Параметры:**
- `MAX_PAGES=100` - максимальное количество страниц (по умолчанию 100)
- `CHUNK_SIZE=1000` - размер чанка в символах
- `CHUNK_OVERLAP=200` - перекрытие между чанками

### 3. Проверить результаты

```sql
-- Количество страниц
SELECT COUNT(*) FROM website_pages;

-- Количество чанков
SELECT COUNT(*) FROM website_content_chunks;

-- Статистика по типам страниц
SELECT page_type, COUNT(*) 
FROM website_pages 
GROUP BY page_type;

-- Последние загруженные страницы
SELECT url, title, page_type, scraped_at 
FROM website_pages 
ORDER BY scraped_at DESC 
LIMIT 10;

-- Лог парсинга
SELECT * FROM website_scraping_log 
ORDER BY started_at DESC 
LIMIT 5;
```

## Процесс парсинга

1. **Обход сайта**: Начинает с главной страницы, находит все ссылки
2. **Парсинг HTML**: Извлекает структурированный контент (заголовки, текст, ссылки, изображения)
3. **Разбивка на чанки**: Делит текст на части по ~1000 символов с перекрытием
4. **Создание эмбеддингов**: Генерирует векторные представления через OpenAI API
5. **Сохранение в БД**: Записывает страницы и чанки в PostgreSQL

## Особенности

- **Автоматическое определение типа страницы** (home, about, services, contact, blog, cars, pricing, faq)
- **Фильтрация контента**: Удаляет навигацию, футеры, скрипты
- **Дедупликация**: Не обрабатывает уже посещенные URL
- **Обработка ошибок**: Логирует ошибки, продолжает работу при сбоях
- **Rate limiting**: Задержка 1 секунда между запросами

## Использование для RAG

После парсинга контент можно использовать для обучения агента:

```sql
-- Поиск похожего контента (semantic search)
SELECT 
  c.content,
  p.url,
  p.title,
  1 - (c.embedding <=> $1::vector) AS similarity
FROM website_content_chunks c
JOIN website_pages p ON c.page_id = p.id
WHERE c.embedding IS NOT NULL
ORDER BY similarity DESC
LIMIT 10;
```

## Примечания

- Эмбеддинги создаются через OpenAI API (требуется API ключ)
- Без API ключа парсинг работает, но эмбеддинги не создаются
- Рекомендуется запускать в фоновом режиме для больших сайтов
- Векторный индекс создается автоматически, но предупреждает о малом количестве данных

