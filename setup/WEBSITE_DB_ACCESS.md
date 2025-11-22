# Доступ к БД с данными парсинга geodrive.info

## База данных

**Тип:** Neon PostgreSQL (облачная БД)  
**Host:** `ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech`  
**Database:** `neondb`  
**User:** `neondb_owner`  
**Port:** `5432`  
**SSL:** Required

## Connection String

```
postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
```

## Способы доступа

### 1. Neon Console (веб-интерфейс) ⭐ РЕКОМЕНДУЕТСЯ

**URL:** https://console.neon.tech/app/projects/rough-heart-ahnybmq0/sql

**Как использовать:**
1. Откройте ссылку выше
2. Войдите в аккаунт Neon (если требуется)
3. Вы увидите SQL редактор
4. Можете выполнять запросы напрямую

**Примеры запросов:**

```sql
-- Статистика парсинга
SELECT 
  (SELECT COUNT(*) FROM website_pages) as pages,
  (SELECT COUNT(*) FROM website_content_chunks) as chunks,
  (SELECT COUNT(*) FROM website_content_chunks WHERE embedding IS NOT NULL) as with_embeddings;

-- Последние страницы
SELECT url, title, page_type, scraped_at 
FROM website_pages 
ORDER BY scraped_at DESC 
LIMIT 10;

-- Поиск контента по ключевому слову
SELECT p.url, p.title, c.content
FROM website_content_chunks c
JOIN website_pages p ON c.page_id = p.id
WHERE c.content ILIKE '%аренда%'
LIMIT 10;

-- Semantic search (поиск похожего контента)
SELECT 
  p.url,
  p.title,
  c.content,
  1 - (c.embedding <=> $1::vector) AS similarity
FROM website_content_chunks c
JOIN website_pages p ON c.page_id = p.id
WHERE c.embedding IS NOT NULL
ORDER BY similarity DESC
LIMIT 10;
```

### 2. Через psql (командная строка)

**Установка psql:**
- Windows: https://www.postgresql.org/download/windows/
- Или используйте Git Bash (включает psql)

**Подключение:**
```bash
psql "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

### 3. Через Node.js скрипты (как мы делаем)

**Пример:**
```javascript
import postgres from 'postgres';

const sql = postgres(
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
  { max: 1, ssl: { rejectUnauthorized: false } }
);

const pages = await sql`SELECT COUNT(*) FROM website_pages`;
console.log(pages);

await sql.end();
```

### 4. Через DBeaver / pgAdmin / другие SQL клиенты

**Настройки подключения:**
- **Host:** `ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech`
- **Port:** `5432`
- **Database:** `neondb`
- **User:** `neondb_owner`
- **Password:** `npg_cHIT9Kxfk1Am`
- **SSL Mode:** Require

## Таблицы с данными парсинга

### 1. `website_pages`
Страницы сайта geodrive.info

**Колонки:**
- `id` (UUID) - уникальный ID
- `url` (TEXT) - URL страницы
- `title` (TEXT) - заголовок страницы
- `description` (TEXT) - мета-описание
- `text_content` (TEXT) - очищенный текст
- `main_content` (TEXT) - основной контент
- `headings` (JSONB) - массив заголовков
- `links` (JSONB) - массив ссылок
- `images` (JSONB) - массив изображений
- `page_type` (TEXT) - тип страницы (home, about, services, etc.)
- `scraped_at` (TIMESTAMPTZ) - время парсинга

### 2. `website_content_chunks`
Чанки контента для RAG

**Колонки:**
- `id` (UUID) - уникальный ID
- `page_id` (UUID) - ссылка на страницу
- `content` (TEXT) - текст чанка (~1000 символов)
- `chunk_index` (INTEGER) - порядковый номер на странице
- `chunk_type` (TEXT) - тип (heading, paragraph, list, etc.)
- `embedding` (vector(1536)) - векторное представление (OpenAI)
- `created_at` (TIMESTAMPTZ) - время создания

### 3. `website_scraping_log`
Лог процесса парсинга

**Колонки:**
- `id` (BIGSERIAL) - ID записи
- `url` (TEXT) - URL начала парсинга
- `status` (TEXT) - статус (pending, success, error)
- `pages_found` (INTEGER) - количество найденных страниц
- `chunks_created` (INTEGER) - количество созданных чанков
- `started_at` (TIMESTAMPTZ) - время начала
- `completed_at` (TIMESTAMPTZ) - время завершения
- `error_message` (TEXT) - сообщение об ошибке (если есть)

## Полезные запросы

### Проверка прогресса
```sql
SELECT 
  (SELECT COUNT(*) FROM website_pages) as pages,
  (SELECT COUNT(*) FROM website_content_chunks) as chunks,
  (SELECT COUNT(*) FROM website_content_chunks WHERE embedding IS NOT NULL) as with_embeddings,
  ROUND(
    (SELECT COUNT(*)::numeric FROM website_content_chunks WHERE embedding IS NOT NULL) / 
    NULLIF((SELECT COUNT(*)::numeric FROM website_content_chunks), 0) * 100, 
    2
  ) as embedding_percent;
```

### Статистика по типам страниц
```sql
SELECT page_type, COUNT(*) as count
FROM website_pages
GROUP BY page_type
ORDER BY count DESC;
```

### Поиск контента
```sql
-- Текстовый поиск
SELECT p.url, p.title, c.content
FROM website_content_chunks c
JOIN website_pages p ON c.page_id = p.id
WHERE c.content ILIKE '%аренда автомобиля%'
LIMIT 10;

-- Semantic search (требуется вектор запроса)
-- Сначала создайте эмбеддинг для вашего запроса через OpenAI API
-- Затем используйте его для поиска
```

### Последние обработанные страницы
```sql
SELECT url, title, page_type, scraped_at
FROM website_pages
ORDER BY scraped_at DESC
LIMIT 10;
```

## Безопасность

⚠️ **ВАЖНО:** 
- Connection string содержит пароль в открытом виде
- Не коммитьте его в публичные репозитории
- Используйте переменные окружения в production
- Пароль: `npg_cHIT9Kxfk1Am` (уже в репозитории, но это тестовая БД)

## Дополнительная информация

- **Neon Dashboard:** https://console.neon.tech
- **Документация Neon:** https://neon.tech/docs
- **pgvector документация:** https://github.com/pgvector/pgvector

