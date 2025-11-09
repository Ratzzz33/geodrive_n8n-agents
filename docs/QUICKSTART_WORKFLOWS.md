# 🚀 Quick Start: Umnico & AmoCRM Workflows

**Время установки:** ~20 минут  
**Требования:** Docker, Docker Compose, доступ к Neon PostgreSQL

---

## ✅ Чеклист перед запуском

- [ ] Docker и Docker Compose установлены
- [ ] Есть доступ к Neon PostgreSQL
- [ ] Есть credentials для Umnico (email + password)
- [ ] Есть credentials для AmoCRM (email + password)
- [ ] n8n запущен и доступен

---

## 📦 Шаг 1: Применить миграции БД

```bash
# Подключиться к Neon PostgreSQL
psql "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Выполнить миграцию
\i sql/conversations_schema.sql

# Проверить созданные таблицы
SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
AND tablename IN ('conversations', 'messages', 'amocrm_deals', 'sync_state');
```

**Ожидаемый результат:** 4 новые таблицы созданы

---

## 🔧 Шаг 2: Настроить .env

Добавьте в `.env` файл:

```bash
# Umnico Playwright Service
UMNICO_EMAIL=geodrive.ge@gmail.com
UMNICO_PASSWORD=2GeoDriveumnicopassword!!))

# AmoCRM Playwright Service
AMOCRM_EMAIL=geodrive.ge@gmail.com
AMOCRM_PASSWORD=wnr3c4%UqN@jY23
AMOCRM_SUBDOMAIN=geodrive
```

---

## 🐳 Шаг 3: Собрать и запустить Playwright сервисы

```bash
# Перейти в директорию services
cd services

# Установить зависимости
npm install

# Собрать TypeScript
npm run build

# Вернуться в корень
cd ..

# Пересобрать Docker образы
docker-compose build playwright-umnico playwright-amocrm

# Запустить сервисы
docker-compose up -d playwright-umnico playwright-amocrm

# Проверить логи
docker-compose logs -f playwright-umnico
docker-compose logs -f playwright-amocrm
```

**Ожидаемые логи:**
```
playwright-umnico  | 🚀 Initializing Umnico Playwright Service...
playwright-umnico  | 🔑 Logging into Umnico...
playwright-umnico  | ✅ Logged in successfully
playwright-umnico  | 💾 Session saved to /data/umnico-session.json
playwright-umnico  | 🚀 Umnico Playwright Service running on http://localhost:3001

playwright-amocrm  | 🚀 Initializing AmoCRM Playwright Service...
playwright-amocrm  | 🔑 Logging into AmoCRM...
playwright-amocrm  | ✅ Logged in successfully
playwright-amocrm  | 💾 Session saved to /data/amocrm-session.json
playwright-amocrm  | 🚀 AmoCRM Playwright Service running on http://localhost:3002
```

---

## ✓ Шаг 4: Проверить работу сервисов

```bash
# Health check Umnico
curl http://46.224.17.15:3001/health

# Ожидаемый ответ:
# {"ok":true,"service":"umnico-playwright","initialized":true,"lastLoginAt":"...","browserConnected":true}

# Health check AmoCRM
curl http://46.224.17.15:3002/health

# Тестовый запрос к Umnico (5 диалогов)
curl http://46.224.17.15:3001/api/conversations?limit=5

# Тестовый запрос к AmoCRM (5 успешных сделок)
curl http://46.224.17.15:3002/api/deals?pipeline_id=8580102&status_id=142&limit=5
```

**Если все OK:** Переходим к импорту workflows

---

## 📥 Шаг 5: Импортировать n8n workflows

### Через n8n UI:

1. Откройте https://n8n.rentflow.rentals
2. Workflows → **Import from File**
3. Выберите `n8n-workflows/umnico-chat-scraper.json`
4. **Save** → Workflow импортирован
5. Повторите для `n8n-workflows/amocrm-deals-scraper.json`

### Через API (альтернатива):

```bash
# Импорт Umnico Chat Scraper
curl -X POST https://n8n.rentflow.rentals/api/v1/workflows \
  -H "X-N8N-API-KEY: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d @n8n-workflows/umnico-chat-scraper.json

# Импорт AmoCRM Deals Scraper
curl -X POST https://n8n.rentflow.rentals/api/v1/workflows \
  -H "X-N8N-API-KEY: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d @n8n-workflows/amocrm-deals-scraper.json
```

---

## ⚙️ Шаг 6: Настроить Credentials в n8n

### PostgreSQL Credential:

1. n8n → Credentials → **Add Credential**
2. Тип: **Postgres**
3. Name: `Neon PostgreSQL`
4. Заполнить:
   ```
   Host: ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech
   Database: neondb
   User: neondb_owner
   Password: npg_cHIT9Kxfk1Am
   SSL: Enable
   SSL: Reject Unauthorized = false
   ```
5. **Save**

---

## ▶️ Шаг 7: Активировать workflows

1. Открыть **Umnico Chat Scraper**
2. Нажать **Active** (toggle в правом верхнем углу)
3. ✅ Workflow активирован (запускается каждые 5 минут)

4. Открыть **AmoCRM Deals Scraper**
5. Нажать **Active**
6. ✅ Workflow активирован (запускается каждые 30 минут)

---

## 🧪 Шаг 8: Тестовый запуск

### Umnico Chat Scraper:

1. Открыть workflow
2. Нажать **Execute Workflow** (manual trigger)
3. Дождаться выполнения (~30-60 сек)
4. Проверить результат:
   ```sql
   SELECT COUNT(*) FROM conversations;
   SELECT COUNT(*) FROM messages;
   ```

### AmoCRM Deals Scraper:

1. Открыть workflow
2. Нажать **Execute Workflow**
3. Дождаться выполнения (~60-120 сек)
4. Проверить результат:
   ```sql
   SELECT COUNT(*) FROM amocrm_deals;
   SELECT status_label, COUNT(*) FROM amocrm_deals GROUP BY status_label;
   ```

---

## 📊 Проверка синхронизации

```sql
-- Статус синхронизации
SELECT 
  workflow_name,
  system,
  last_sync_at,
  status,
  items_processed,
  items_added
FROM sync_state
ORDER BY last_sync_at DESC;

-- Количество данных
SELECT 
  'Conversations' AS table_name, COUNT(*) AS count FROM conversations
UNION ALL
SELECT 'Messages (Umnico)', COUNT(*) FROM messages WHERE channel = 'whatsapp'
UNION ALL
SELECT 'Messages (AmoCRM notes)', COUNT(*) FROM messages WHERE channel = 'amocrm_note'
UNION ALL
SELECT 'AmoCRM Deals', COUNT(*) FROM amocrm_deals
UNION ALL
SELECT 'Clients', COUNT(*) FROM clients;

-- Клиенты с несколькими external_refs
SELECT 
  c.phone,
  c.name,
  COUNT(DISTINCT er.system) AS systems_count,
  STRING_AGG(er.system, ', ') AS systems
FROM clients c
JOIN external_refs er ON c.id = er.entity_id
WHERE er.entity_type = 'client'
GROUP BY c.id, c.phone, c.name
HAVING COUNT(DISTINCT er.system) > 1
ORDER BY systems_count DESC
LIMIT 10;
```

---

## ✅ Успех!

Если все шаги выполнены:

- ✅ Playwright сервисы работают (автоматический login)
- ✅ n8n workflows активированы
- ✅ Данные синхронизируются автоматически:
  - Umnico: каждые 5 минут
  - AmoCRM: каждые 30 минут
- ✅ Таблицы заполняются данными
- ✅ External refs связывают клиентов между системами

---

## 🔄 Автозапуск при рестарте сервера

**Docker Compose** настроен с `restart: unless-stopped`:

```bash
# При рестарте сервера автоматически запустятся:
- playwright-umnico (с автологином)
- playwright-amocrm (с автологином)
- n8n (с активными workflows)
```

Проверить после рестарта:

```bash
docker-compose ps
# Все сервисы должны быть "Up"

curl http://46.224.17.15:3001/health
curl http://46.224.17.15:3002/health
```

---

## ⚠️ Troubleshooting

### Playwright не логинится:

```bash
# Проверить credentials в .env
cat .env | grep UMNICO
cat .env | grep AMOCRM

# Пересоздать контейнер
docker-compose stop playwright-umnico
docker-compose rm -f playwright-umnico
docker-compose up -d playwright-umnico

# Проверить логи
docker-compose logs playwright-umnico | grep -E "Login|Error"
```

### Workflow не запускается:

```bash
# Проверить что credentials настроены
# n8n UI → Credentials → найти "Neon PostgreSQL"

# Проверить доступность Playwright services изнутри n8n
docker exec -it n8n sh
curl http://playwright-umnico:3001/health
curl http://playwright-amocrm:3002/health
```

### Нет данных в таблицах:

```bash
# Проверить sync_state
SELECT * FROM sync_state;

# Если status = 'error', проверить error_message
SELECT workflow_name, error_message FROM sync_state WHERE status = 'error';

# Проверить логи n8n
docker-compose logs n8n | grep -E "Umnico|AmoCRM"
```

---

## 📚 Полная документация

См. `docs/WORKFLOWS_SPEC.md` для детальной информации об архитектуре, API endpoints и troubleshooting.

---

**Готово к работе!** 🎉

