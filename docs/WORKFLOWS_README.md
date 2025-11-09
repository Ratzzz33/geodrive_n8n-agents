# 📋 Workflows: Umnico & AmoCRM Data Collection

**Версия:** 1.0  
**Дата:** 2025-11-09  
**Статус:** ✅ Ready for deployment

---

## 🎯 Что это?

Система автоматического сбора данных из **Umnico** (переписка с клиентами) и **AmoCRM** (успешные/неуспешные сделки) для последующей обработки AI агентами.

### Ключевые особенности:

- ✅ **Постоянно работающие браузеры** (Playwright) - не нужно логиниться каждый раз
- ✅ **Автоматическая синхронизация** - Umnico каждые 5 мин, AmoCRM каждые 30 мин
- ✅ **Incremental updates** - собираем только новые/обновленные данные
- ✅ **External References Pattern** - связываем данные между системами по телефону
- ✅ **Автозапуск** - все сервисы стартуют автоматически при рестарте сервера

---

## 📦 Компоненты

### 1. Playwright Services (2 контейнера)

**Umnico Service** (`:3001`)
- Постоянный браузер с сохраненной сессией
- Автологин при старте
- HTTP API для n8n
- Endpoints: `/api/conversations`, `/api/conversations/:id/messages`

**AmoCRM Service** (`:3002`)
- Постоянный браузер с сохраненной сессией
- Автологин при старте
- HTTP API для n8n + REST API через браузерную сессию
- Endpoints: `/api/deals`, `/api/deals/:id`, `/api/deals/:id/notes`

### 2. n8n Workflows (2 workflow)

**Umnico Chat Scraper** (каждые 5 минут)
- Получает список диалогов
- Для каждого диалога извлекает сообщения
- Сохраняет: clients, conversations, messages
- Добавляет external_ref (umnico → client)

**AmoCRM Deals Scraper** (каждые 30 минут)
- Получает успешные (142) и неуспешные (143) сделки
- Извлекает детали + примечания
- Сохраняет: clients, amocrm_deals, messages (из notes)
- Добавляет external_refs (amocrm + rentprog → client)

### 3. База данных (Neon PostgreSQL)

**Новые таблицы:**
- `conversations` - диалоги (umnico_conversation_id)
- `messages` - история переписки (whatsapp + amocrm_note)
- `amocrm_deals` - сделки (успешные/неуспешные)
- `amocrm_contacts` - контакты AmoCRM
- `sync_state` - статус синхронизации

**Расширенные таблицы:**
- `clients` (+telegram_username, +email)
- `external_refs` (связи: umnico, amocrm, rentprog)

---

## 🚀 Быстрый старт

```bash
# 1. Применить миграции
psql "postgresql://..." -f sql/conversations_schema.sql

# 2. Настроить .env
echo "UMNICO_EMAIL=..." >> .env
echo "UMNICO_PASSWORD=..." >> .env
echo "AMOCRM_EMAIL=..." >> .env
echo "AMOCRM_PASSWORD=..." >> .env

# 3. Собрать и запустить
cd services && npm install && npm run build && cd ..
docker-compose build playwright-umnico playwright-amocrm
docker-compose up -d

# 4. Проверить
curl http://46.224.17.15:3001/health
curl http://46.224.17.15:3002/health

# 5. Импортировать workflows в n8n UI
# 6. Активировать workflows
```

**Детальная инструкция:** `docs/QUICKSTART_WORKFLOWS.md`

---

## 📊 Структура данных

### Связывание через External Refs:

```
Client (UUID)
    ↓
├─ external_refs: umnico → +995599001665
├─ external_refs: amocrm → 38638793
└─ external_refs: rentprog → 12345
    ↓
conversations (umnico_conversation_id)
    ↓
messages (channel: whatsapp | amocrm_note)
    ↓
amocrm_deals (status_label: successful | unsuccessful)
```

### Пример SQL запроса:

```sql
-- Получить всю информацию о клиенте
SELECT 
  c.phone,
  c.name,
  er_umnico.external_id AS umnico_id,
  er_amo.external_id AS amocrm_id,
  er_rp.external_id AS rentprog_id,
  COUNT(DISTINCT conv.id) AS conversations_count,
  COUNT(DISTINCT m.id) AS messages_count,
  COUNT(DISTINCT d.id) AS deals_count
FROM clients c
LEFT JOIN external_refs er_umnico ON c.id = er_umnico.entity_id AND er_umnico.system = 'umnico'
LEFT JOIN external_refs er_amo ON c.id = er_amo.entity_id AND er_amo.system = 'amocrm'
LEFT JOIN external_refs er_rp ON c.id = er_rp.entity_id AND er_rp.system = 'rentprog'
LEFT JOIN conversations conv ON c.id = conv.client_id
LEFT JOIN messages m ON c.id = m.client_id
LEFT JOIN amocrm_deals d ON c.id = d.client_id
WHERE c.phone = '+995599001665'
GROUP BY c.id, c.phone, c.name, er_umnico.external_id, er_amo.external_id, er_rp.external_id;
```

---

## 📁 Файловая структура

```
geodrive_n8n-agents/
├── services/
│   ├── playwright-umnico.ts       # Umnico Playwright Service
│   ├── playwright-amocrm.ts       # AmoCRM Playwright Service
│   ├── Dockerfile.umnico          # Docker для Umnico
│   ├── Dockerfile.amocrm          # Docker для AmoCRM
│   ├── package.json
│   └── tsconfig.json
├── n8n-workflows/
│   ├── umnico-chat-scraper.json   # Workflow: Umnico
│   └── amocrm-deals-scraper.json  # Workflow: AmoCRM
├── sql/
│   └── conversations_schema.sql   # Миграции БД
├── docs/
│   ├── WORKFLOWS_SPEC.md          # Полная спецификация
│   ├── QUICKSTART_WORKFLOWS.md    # Быстрый старт
│   └── WORKFLOWS_README.md        # Этот файл
├── docker-compose.yml             # Обновлен (добавлены playwright сервисы)
└── .env.example                   # Пример переменных окружения
```

---

## 🔧 API Endpoints

### Umnico Service (`:3001`)

```http
GET  /health
GET  /api/conversations?limit=50
GET  /api/conversations/:id/messages
POST /api/relogin
```

### AmoCRM Service (`:3002`)

```http
GET  /health
GET  /api/pipelines/:id
GET  /api/deals?pipeline_id=8580102&status_id=142&limit=250
GET  /api/deals/:id
GET  /api/deals/:id/notes
GET  /api/inbox
POST /api/relogin
```

---

## 📈 Мониторинг

### Проверка статуса синхронизации:

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

### Статистика данных:

```sql
SELECT 
  'Conversations' AS type, COUNT(*) AS count FROM conversations
UNION ALL
SELECT 'Messages (Umnico)', COUNT(*) FROM messages WHERE channel = 'whatsapp'
UNION ALL
SELECT 'Messages (AmoCRM)', COUNT(*) FROM messages WHERE channel = 'amocrm_note'
UNION ALL
SELECT 'Deals (Successful)', COUNT(*) FROM amocrm_deals WHERE status_label = 'successful'
UNION ALL
SELECT 'Deals (Unsuccessful)', COUNT(*) FROM amocrm_deals WHERE status_label = 'unsuccessful'
UNION ALL
SELECT 'Clients', COUNT(*) FROM clients;
```

---

## ⚠️ Troubleshooting

### Playwright Service не работает:

```bash
# Проверить логи
docker-compose logs playwright-umnico

# Принудительный re-login
curl -X POST http://46.224.17.15:3001/api/relogin

# Пересоздать контейнер
docker-compose stop playwright-umnico
docker-compose rm -f playwright-umnico
docker-compose up -d playwright-umnico
```

### Workflow не синхронизирует:

```bash
# Проверить sync_state
SELECT * FROM sync_state WHERE status = 'error';

# Проверить доступность Playwright services
docker exec -it n8n curl http://playwright-umnico:3001/health
docker exec -it n8n curl http://playwright-amocrm:3002/health

# Проверить credentials в n8n
# n8n UI → Credentials → "Neon PostgreSQL"
```

---

## 🔮 Следующие шаги

После успешного запуска этих workflows (Фаза 1), следующие фазы:

### Фаза 2: Embeddings & RAG
- Chunking сообщений (512-1024 токена)
- Vector embeddings через bge-m3
- Semantic search по успешным диалогам
- `message_embeddings` таблица (уже создана)

### Фаза 3: Night Agent MVP
- Автоответы на основе RAG
- Политики и guardrails (белый список интентов)
- Эскалация сложных кейсов
- Метрики: conversion rate, reply rate, escalation rate

---

## 📚 Документация

- **Полная спецификация:** `docs/WORKFLOWS_SPEC.md`
- **Быстрый старт:** `docs/QUICKSTART_WORKFLOWS.md`
- **AmoCRM Reconnaissance:** `amocrm/RECONNAISSANCE_REPORT.md`
- **Umnico Reconnaissance:** `umnico/UMNICO_RECONNAISSANCE_REPORT.md`
- **Архитектура:** `ARCHITECTURE.md`

---

## 🎉 Готово!

Система готова к деплою. Все компоненты протестированы и документированы.

**Время работы:** 
- Разработка: ~4 часа
- Тестирование: ~1 час
- Деплой: ~20 минут

**Поддержка:** См. Troubleshooting в `docs/WORKFLOWS_SPEC.md`

---

**Автор:** Jarvis AI Agent  
**Дата:** 2025-11-09  
**Версия:** 1.0

