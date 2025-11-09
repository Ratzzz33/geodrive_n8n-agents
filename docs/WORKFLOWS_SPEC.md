# 📋 Спецификация Workflows: Umnico & AmoCRM Scrapers

**Дата создания:** 2025-11-09  
**Версия:** 1.0  
**Статус:** ✅ Ready for deployment

---

## 🎯 Обзор

Система из **двух n8n workflows** для сбора данных из Umnico (чаты) и AmoCRM (сделки) с использованием **постоянно работающих Playwright браузеров**.

### Компоненты системы:

1. **Playwright Service (Umnico)** - постоянный браузер с сессией Umnico
2. **Playwright Service (AmoCRM)** - постоянный браузер с сессией AmoCRM
3. **n8n Workflow: Umnico Chat Scraper** - синхронизация переписки
4. **n8n Workflow: AmoCRM Deals Scraper** - синхронизация сделок
5. **PostgreSQL (Neon)** - хранение данных

---

## 🏗️ Архитектура

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Compose                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐      ┌──────────────────┐        │
│  │  Playwright      │      │  Playwright      │        │
│  │  Umnico Service  │      │  AmoCRM Service  │        │
│  │  :3001           │      │  :3002           │        │
│  └────────┬─────────┘      └────────┬─────────┘        │
│           │                         │                   │
│           │                         │                   │
│           ▼                         ▼                   │
│  ┌──────────────────────────────────────────┐          │
│  │           n8n :5678                       │          │
│  │                                           │          │
│  │  ┌──────────────┐  ┌──────────────────┐ │          │
│  │  │ Umnico Chat  │  │ AmoCRM Deals     │ │          │
│  │  │ Scraper      │  │ Scraper          │ │          │
│  │  │ (every 5min) │  │ (every 30min)    │ │          │
│  │  └───────┬──────┘  └──────┬───────────┘ │          │
│  └──────────┼────────────────┼─────────────┘          │
│             │                │                         │
│             ▼                ▼                         │
│  ┌──────────────────────────────────────────┐          │
│  │      Neon PostgreSQL (Cloud)             │          │
│  │  - conversations                         │          │
│  │  - messages                              │          │
│  │  - amocrm_deals                          │          │
│  │  - clients                               │          │
│  │  - external_refs                         │          │
│  └──────────────────────────────────────────┘          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 Playwright Services

### 1. Umnico Playwright Service

**Порт:** `3001`  
**URL:** `http://playwright-umnico:3001` (internal Docker network)  
**Статус:** Постоянно работает (restart: unless-stopped)

#### Функции:
- ✅ Автоматический логин при старте
- ✅ Сохранение сессии в `/data/umnico-session.json`
- ✅ Автоматический re-login при истечении сессии (каждые 30 минут проверка)
- ✅ HTTP API для n8n workflow

#### API Endpoints:

```http
GET /health
# Проверка статуса сервиса

GET /api/conversations?limit=50
# Получить список диалогов
# Response: { ok: true, count: 50, data: [...] }

GET /api/conversations/:id/messages
# Получить сообщения конкретного диалога
# Response: { ok: true, conversationId: "...", count: 42, data: [...] }

POST /api/relogin
# Принудительный re-login
# Response: { ok: true, message: "Re-logged successfully" }
```

#### Конфигурация:

```yaml
# docker-compose.yml
playwright-umnico:
  build:
    context: ./services
    dockerfile: Dockerfile.umnico
  container_name: playwright-umnico
  restart: unless-stopped
  ports:
    - "3001:3001"
  environment:
    - UMNICO_EMAIL=${UMNICO_EMAIL}
    - UMNICO_PASSWORD=${UMNICO_PASSWORD}
    - UMNICO_PLAYWRIGHT_PORT=3001
    - UMNICO_STATE_FILE=/data/umnico-session.json
  volumes:
    - playwright_umnico_data:/data
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
    interval: 60s
    timeout: 10s
    retries: 3
```

---

### 2. AmoCRM Playwright Service

**Порт:** `3002`  
**URL:** `http://playwright-amocrm:3002` (internal Docker network)  
**Статус:** Постоянно работает (restart: unless-stopped)

#### Функции:
- ✅ Автоматический логин при старте
- ✅ Сохранение сессии в `/data/amocrm-session.json`
- ✅ Автоматический re-login при истечении сессии (каждые 30 минут проверка)
- ✅ HTTP API для n8n workflow + REST API через браузерную сессию

#### API Endpoints:

```http
GET /health
# Проверка статуса сервиса

GET /api/pipelines/:id
# Получить структуру воронки
# Example: GET /api/pipelines/8580102

GET /api/deals?pipeline_id=8580102&status_id=142&limit=250&page=1&updated_since=...
# Получить список сделок
# Response: { ok: true, deals: [...], total: 100, hasMore: true }

GET /api/deals/:id
# Получить детали сделки (с контактами)
# Response: { ok: true, data: {...} }

GET /api/deals/:id/notes
# Получить примечания сделки
# Response: { ok: true, count: 5, data: [...] }

GET /api/inbox
# Получить список диалогов (для связи с Umnico)
# Response: { ok: true, count: 10, data: [...] }

POST /api/relogin
# Принудительный re-login
```

#### Конфигурация:

```yaml
# docker-compose.yml
playwright-amocrm:
  build:
    context: ./services
    dockerfile: Dockerfile.amocrm
  container_name: playwright-amocrm
  restart: unless-stopped
  ports:
    - "3002:3002"
  environment:
    - AMOCRM_EMAIL=${AMOCRM_EMAIL}
    - AMOCRM_PASSWORD=${AMOCRM_PASSWORD}
    - AMOCRM_SUBDOMAIN=${AMOCRM_SUBDOMAIN:-geodrive}
    - AMOCRM_PLAYWRIGHT_PORT=3002
    - AMOCRM_STATE_FILE=/data/amocrm-session.json
  volumes:
    - playwright_amocrm_data:/data
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3002/health"]
    interval: 60s
    timeout: 10s
    retries: 3
```

---

## 📊 Workflow 1: Umnico Chat Scraper

**Файл:** `n8n-workflows/umnico-chat-scraper.json`  
**Триггер:** Cron (каждые 5 минут)  
**Назначение:** Синхронизация истории переписки с клиентами из Umnico

### Алгоритм:

```
1. [Cron] Триггер каждые 5 минут
   ↓
2. [Postgres] Получить последний timestamp синхронизации
   SELECT MAX(last_message_at) FROM conversations WHERE status = 'active'
   ↓
3. [HTTP] Получить список диалогов из Playwright Service
   GET http://playwright-umnico:3001/api/conversations?limit=50
   ↓
4. [Code] Фильтровать только новые/обновленные диалоги
   (по last_message_at > last_check)
   ↓
5. [Loop] Для каждого диалога:
   ↓
   5a. [HTTP] Получить сообщения
       GET http://playwright-umnico:3001/api/conversations/:id/messages
   ↓
   5b. [Postgres] Upsert клиента по телефону
       INSERT INTO clients (phone) ... ON CONFLICT (phone) DO UPDATE ...
   ↓
   5c. [Postgres] Добавить external_ref для Umnico
       INSERT INTO external_refs (system='umnico', external_id=phone)
   ↓
   5d. [Postgres] Upsert диалог
       INSERT INTO conversations (umnico_conversation_id, ...)
   ↓
   5e. [Code] Подготовить messages для batch insert
   ↓
   5f. [Postgres] Batch insert сообщений
       INSERT INTO messages (...) ON CONFLICT DO NOTHING
   ↓
6. [Postgres] Обновить sync_state
   UPDATE sync_state SET last_sync_at = now() WHERE workflow_name = 'umnico_scraper'
```

### Пример сохраненных данных:

**clients:**
```sql
id: uuid-123
phone: +919810558569
name: null
created_at: 2025-11-09 10:40:00
```

**external_refs:**
```sql
entity_type: 'client'
entity_id: uuid-123
system: 'umnico'
external_id: '+919810558569'
```

**conversations:**
```sql
id: uuid-456
client_id: uuid-123
umnico_conversation_id: '61965921'
channel: 'whatsapp'
channel_account: '995599001665'
status: 'active'
last_message_at: 2025-11-09 11:14:00
```

**messages:**
```sql
id: uuid-789
client_id: uuid-123
conversation_id: uuid-456
text: 'Hi'
direction: 'incoming'
channel: 'whatsapp'
sent_at: 2025-11-09 10:40:00
```

---

## 📊 Workflow 2: AmoCRM Deals Scraper

**Файл:** `n8n-workflows/amocrm-deals-scraper.json`  
**Триггер:** Cron (каждые 30 минут)  
**Назначение:** Синхронизация успешных/неуспешных сделок из AmoCRM

### Алгоритм:

```
1. [Cron] Триггер каждые 30 минут
   ↓
2. [Postgres] Получить последний timestamp синхронизации
   SELECT MAX(updated_at) FROM amocrm_deals
   ↓
3. [HTTP x2] Получить сделки из Playwright Service
   - GET /api/deals?pipeline_id=8580102&status_id=142 (successful)
   - GET /api/deals?pipeline_id=8580102&status_id=143 (unsuccessful)
   ↓
4. [Code] Объединить успешные и неуспешные сделки
   ↓
5. [Loop] Для каждой сделки:
   ↓
   5a. [HTTP] Получить детали сделки (с контактами)
       GET /api/deals/:id
   ↓
   5b. [HTTP] Получить примечания (notes)
       GET /api/deals/:id/notes
   ↓
   5c. [Code] Извлечь данные:
       - Телефон из contacts
       - Custom fields (rentprog_client_id, rentprog_booking_id)
       - Статус, цену, даты
   ↓
   5d. [Postgres] Upsert клиента по телефону
       INSERT INTO clients (phone, name) ... ON CONFLICT (phone) DO UPDATE ...
   ↓
   5e. [Postgres] Добавить external_refs (AmoCRM + RentProg)
       INSERT INTO external_refs (system='amocrm', external_id=contact_id)
       INSERT INTO external_refs (system='rentprog', external_id=rentprog_client_id)
   ↓
   5f. [Postgres] Upsert сделку
       INSERT INTO amocrm_deals (amocrm_deal_id, status_label='successful', ...)
   ↓
   5g. [Code] Подготовить notes как messages (для RAG)
   ↓
   5h. [Postgres] Batch insert notes as messages
       INSERT INTO messages (channel='amocrm_note', ...)
   ↓
6. [Postgres] Обновить sync_state
   UPDATE sync_state SET last_sync_at = now() WHERE workflow_name = 'amocrm_deals_scraper'
```

### Пример сохраненных данных:

**clients:**
```sql
id: uuid-234
phone: +995599001234
name: 'John Doe'
created_at: 2025-11-09 12:00:00
```

**external_refs (3 записи для одного клиента):**
```sql
-- AmoCRM
entity_type: 'client', entity_id: uuid-234, system: 'amocrm', external_id: '38638793'

-- Umnico (если был чат)
entity_type: 'client', entity_id: uuid-234, system: 'umnico', external_id: '+995599001234'

-- RentProg (из custom fields)
entity_type: 'client', entity_id: uuid-234, system: 'rentprog', external_id: '12345'
```

**amocrm_deals:**
```sql
id: uuid-567
client_id: uuid-234
amocrm_deal_id: '38617385'
pipeline_id: '8580102'
status_id: '142'
status_label: 'successful'
price: 1500.00
created_at: 2025-11-01 10:00:00
closed_at: 2025-11-09 15:00:00
custom_fields: {"rentprog_client_id": "12345", "rentprog_booking_id": "470049"}
notes_count: 8
```

**messages (из notes):**
```sql
id: uuid-890
client_id: uuid-234
conversation_id: null
text: 'Клиент подтвердил бронь'
direction: 'outgoing'
channel: 'amocrm_note'
sent_at: 2025-11-08 14:30:00
metadata: {"note_type": "common", "amocrm_note_id": "123456"}
```

---

## 🔗 Связывание данных через External Refs

### Пример полной связи:

```
Client UUID: uuid-abc-123
    ↓
├─ external_refs: system='umnico', external_id='+995599001665'
├─ external_refs: system='amocrm', external_id='38638793'
└─ external_refs: system='rentprog', external_id='12345'
    ↓
conversations:
├─ umnico_conversation_id: '61965921'
└─ amocrm_scope_id: '38187' (если есть чат в AmoCRM)
    ↓
messages:
├─ channel='whatsapp' (из Umnico)
└─ channel='amocrm_note' (из AmoCRM notes)
    ↓
amocrm_deals:
├─ status_label='successful'
└─ custom_fields: {"rentprog_booking_id": "470049"}
```

### SQL запрос для полной информации о клиенте:

```sql
-- Получить все данные клиента из всех систем
SELECT 
  c.id AS client_id,
  c.phone,
  c.name,
  
  -- External IDs
  MAX(CASE WHEN er.system = 'umnico' THEN er.external_id END) AS umnico_id,
  MAX(CASE WHEN er.system = 'amocrm' THEN er.external_id END) AS amocrm_id,
  MAX(CASE WHEN er.system = 'rentprog' THEN er.external_id END) AS rentprog_id,
  
  -- Conversations
  COUNT(DISTINCT conv.id) AS total_conversations,
  
  -- Messages
  COUNT(DISTINCT m.id) AS total_messages,
  
  -- Deals
  COUNT(DISTINCT d.id) AS total_deals,
  SUM(CASE WHEN d.status_label = 'successful' THEN 1 ELSE 0 END) AS successful_deals,
  SUM(CASE WHEN d.status_label = 'unsuccessful' THEN 1 ELSE 0 END) AS unsuccessful_deals

FROM clients c
LEFT JOIN external_refs er ON c.id = er.entity_id AND er.entity_type = 'client'
LEFT JOIN conversations conv ON c.id = conv.client_id
LEFT JOIN messages m ON c.id = m.client_id
LEFT JOIN amocrm_deals d ON c.id = d.client_id

WHERE c.phone = '+995599001665'

GROUP BY c.id, c.phone, c.name;
```

---

## 🚀 Деплой и запуск

### 1. Применить миграции БД

```bash
# Подключиться к Neon PostgreSQL
psql "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Выполнить миграцию
\i sql/conversations_schema.sql
```

### 2. Настроить .env файл

```bash
# Скопировать .env.example
cp .env.example .env

# Заполнить переменные:
UMNICO_EMAIL=geodrive.ge@gmail.com
UMNICO_PASSWORD=2GeoDriveumnicopassword!!))

AMOCRM_EMAIL=geodrive.ge@gmail.com
AMOCRM_PASSWORD=wnr3c4%UqN@jY23
AMOCRM_SUBDOMAIN=geodrive
```

### 3. Собрать Playwright сервисы

```bash
cd services
npm install
npm run build
cd ..
```

### 4. Запустить Docker Compose

```bash
# Пересобрать образы
docker-compose build

# Запустить все сервисы
docker-compose up -d

# Проверить логи
docker-compose logs -f playwright-umnico
docker-compose logs -f playwright-amocrm
docker-compose logs -f n8n
```

### 5. Импортировать n8n workflows

```bash
# Через n8n UI:
# 1. Открыть https://n8n.rentflow.rentals
# 2. Workflows → Import from File
# 3. Выбрать n8n-workflows/umnico-chat-scraper.json
# 4. Выбрать n8n-workflows/amocrm-deals-scraper.json
# 5. Активировать оба workflow
```

### 6. Проверить работу

```bash
# Health check Umnico service
curl http://46.224.17.15:3001/health

# Health check AmoCRM service
curl http://46.224.17.15:3002/health

# Тестовый запрос к Umnico
curl http://46.224.17.15:3001/api/conversations?limit=5

# Тестовый запрос к AmoCRM
curl http://46.224.17.15:3002/api/deals?pipeline_id=8580102&status_id=142&limit=5
```

---

## 🔄 Incremental Updates

### Umnico (каждые 5 минут):

```sql
-- Сохраняем last_check
SELECT MAX(last_message_at) FROM conversations WHERE status = 'active';

-- На следующем запуске: фильтруем только обновленные
```

### AmoCRM (каждые 30 минут):

```sql
-- Сохраняем last_sync
SELECT MAX(updated_at) FROM amocrm_deals;

-- API запрос с фильтром
GET /api/deals?updated_since=2025-11-09T10:00:00Z
```

---

## 📈 Мониторинг

### Таблица sync_state:

```sql
SELECT 
  workflow_name,
  system,
  last_sync_at,
  status,
  items_processed,
  items_added,
  error_message
FROM sync_state
ORDER BY last_sync_at DESC;
```

### Статистика синхронизации:

```sql
-- Количество данных из каждой системы
SELECT 
  'Umnico Conversations' AS source, COUNT(*) AS count 
FROM conversations WHERE umnico_conversation_id IS NOT NULL

UNION ALL

SELECT 
  'AmoCRM Deals', COUNT(*) 
FROM amocrm_deals

UNION ALL

SELECT 
  'Umnico Messages', COUNT(*) 
FROM messages WHERE channel = 'whatsapp'

UNION ALL

SELECT 
  'AmoCRM Notes', COUNT(*) 
FROM messages WHERE channel = 'amocrm_note'

UNION ALL

SELECT 
  'Clients with multiple refs', COUNT(*) 
FROM (
  SELECT entity_id 
  FROM external_refs 
  WHERE entity_type = 'client' 
  GROUP BY entity_id 
  HAVING COUNT(DISTINCT system) > 1
) AS multi_ref;
```

---

## ⚠️ Troubleshooting

### Playwright Service не стартует:

```bash
# Проверить логи
docker-compose logs playwright-umnico

# Пересобрать образ
docker-compose build playwright-umnico
docker-compose up -d playwright-umnico

# Проверить health
curl http://localhost:3001/health
```

### Сессия истекла:

```bash
# Принудительный re-login Umnico
curl -X POST http://46.224.17.15:3001/api/relogin

# Принудительный re-login AmoCRM
curl -X POST http://46.224.17.15:3002/api/relogin
```

### Workflow не синхронизирует:

```bash
# Проверить статус в БД
SELECT * FROM sync_state WHERE workflow_name = 'umnico_scraper';

# Проверить логи n8n
docker-compose logs n8n | grep "Umnico Chat Scraper"

# Проверить доступность Playwright services
curl http://playwright-umnico:3001/health (изнутри n8n контейнера)
```

---

## 🔮 Roadmap (Future Phases)

После успешного запуска этих workflows:

### Фаза 2: Embeddings & RAG
- Chunking сообщений (512-1024 токена)
- Vector embeddings через bge-m3
- Semantic search по победным диалогам

### Фаза 3: Night Agent MVP
- Автоответы на основе RAG
- Политики и guardrails
- Эскалация сложных кейсов

---

## 📚 Дополнительные ресурсы

- **AmoCRM Reconnaissance:** `amocrm/RECONNAISSANCE_REPORT.md`
- **Umnico Reconnaissance:** `umnico/UMNICO_RECONNAISSANCE_REPORT.md`
- **Architecture:** `ARCHITECTURE.md`
- **Database Schema:** `sql/conversations_schema.sql`

---

**Статус:** ✅ Ready for deployment!  
**Последнее обновление:** 2025-11-09

