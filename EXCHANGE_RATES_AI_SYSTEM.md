# 💱 Exchange Rates AI System

Интеллектуальная система парсинга и работы с курсами валют через Telegram бота с AI Agent.

---

## 📋 Архитектура

### 1. База данных

**Таблица:** `exchange_rates`

```sql
CREATE TABLE exchange_rates (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  branch TEXT NOT NULL,
  gel_to_usd DECIMAL(10, 6),
  gel_to_eur DECIMAL(10, 6),
  gel_to_rub DECIMAL(10, 6),
  usd_to_gel DECIMAL(10, 6),
  eur_to_gel DECIMAL(10, 6),
  rub_to_gel DECIMAL(10, 6),
  raw_data JSONB
);
```

**Индексы:**
- `idx_exchange_rates_branch` - поиск по филиалу
- `idx_exchange_rates_ts` - поиск по времени
- `idx_exchange_rates_branch_ts` - комбинированный

---

### 2. Workflow парсинга

**Файл:** `n8n-workflows/rentprog-exchange-rates-parser.json`  
**ID:** `VggQLPapIgWHeBl0`  
**URL:** https://n8n.rentflow.rentals/workflow/VggQLPapIgWHeBl0

**Архитектура:**
```
Every Hour (Schedule Trigger)
  ↓
Prepare Tbilisi (токен)
  ↓
Get Company Profile Page (GET https://web.rentprog.ru/company_profile)
  ↓
Parse Exchange Rates (regex парсинг HTML)
  ↓
Check for Errors (If)
  ├─ TRUE → Log Error → events table
  └─ FALSE → Save to DB → exchange_rates table
              ↓
           Format Result
```

**Что парсится:**
- GEL ↔ USD (обычно ~0.3704)
- GEL ↔ EUR
- GEL ↔ RUB

**Регулярки:**
```javascript
/GEL\s*<->\s*\$[\s\S]*?value="([0-9.]+)"/   // USD
/GEL\s*<->\s*€[\s\S]*?value="([0-9.]+)"/    // EUR
/GEL\s*<->\s*₽[\s\S]*?value="([0-9.]+)"/    // RUB
```

**Частота:** каждый час  
**Филиал:** tbilisi (можно расширить на все филиалы)

---

### 3. AI Agent система

**Состоит из 3 workflows:**

#### A. Query Exchange Rates Tool

**Файл:** `n8n-workflows/query-exchange-rates-tool.json`  
**Назначение:** Инструмент для AI Agent, выполняет SQL запросы

**Параметры:**
- `branch` - филиал (tbilisi/batumi/kutaisi/service-center/all)
- `date` - дата в формате YYYY-MM-DD (опционально)

**Возвращает:**
```json
{
  "ok": true,
  "count": 1,
  "data": [
    {
      "branch": "tbilisi",
      "rates": {
        "gel_to_usd": "0.3704",
        "gel_to_eur": "0.3450",
        "gel_to_rub": "0.0037",
        "usd_to_gel": "2.6998",
        "eur_to_gel": "2.8986",
        "rub_to_gel": "270.2703"
      },
      "timestamp": "2025-11-08T10:00:00.000Z"
    }
  ]
}
```

**Архитектура:**
```
Execute Workflow Trigger
  ↓
Prepare Params (branch, date)
  ↓
Query Database (динамический SQL)
  ↓
Check Results (If)
  ├─ Has Data → Format Response
  └─ No Data → No Data Response
```

---

#### B. Exchange Rates AI Assistant

**Файл:** `n8n-workflows/exchange-rates-ai-agent.json`  
**Назначение:** AI Agent с Chat Trigger, обрабатывает вопросы пользователей

**Ноды:**
- **Chat Trigger** - входная точка для чат-сообщений
- **AI Agent** - координирует вызовы инструментов
- **OpenAI Chat Model** (gpt-4o-mini) - языковая модель
- **Tool: Query Exchange Rates** - подключенный инструмент

**System Message:**
```
Ты — помощник по курсам валют в системе RentProg.

Твоя задача:
1. Отвечать на вопросы о курсах валют (GEL, USD, EUR, RUB)
2. Использовать инструмент Query Exchange Rates для получения данных из БД
3. Давать четкие и понятные ответы на русском языке

Филиалы: tbilisi, batumi, kutaisi, service-center

Примеры вопросов:
- Какой курс доллара сейчас?
- Сколько стоит евро в тбилиси?
- Покажи курсы по всем филиалам
- Какой был курс рубля вчера?
```

**Вызов через HTTP:**
```bash
POST https://n8n.rentflow.rentals/webhook/exchange-rates-ai-chat
Content-Type: application/json

{
  "sessionId": "user_123",
  "chatInput": "Какой курс доллара?"
}
```

**Ответ:**
```json
{
  "output": "💱 Текущий курс доллара в Тбилиси:\n\nGEL → USD: 0.3704\nUSD → GEL: 2.6998\n\nДанные обновлены: 2025-11-08 10:00:00",
  "sessionId": "user_123"
}
```

---

#### C. Telegram Exchange Rates Bot

**Файл:** `n8n-workflows/telegram-exchange-rates-bot.json`  
**Назначение:** Telegram бот, который вызывает AI Agent

**Архитектура:**
```
Telegram Trigger
  ↓
Process Message
  ↓
Is Command? (If)
  ├─ TRUE → Send Command Response (/start)
  └─ FALSE → Call AI Agent (HTTP Request)
              ↓
           Send Response (Telegram)
```

**Поддерживаемые команды:**
- `/start` - приветствие и инструкция

**Примеры вопросов:**
- "Какой курс доллара?"
- "Покажи курсы по всем филиалам"
- "Какой был курс евро вчера?"
- "Сколько стоит рубль?"

---

## 🚀 Установка

### 1. Создать таблицу в БД

```bash
node setup/run_exchange_rates_migration.mjs
```

**Результат:**
```
✅ Таблица exchange_rates создана!
📊 Записей в таблице: 0
```

---

### 2. Импортировать workflows

#### Вариант A: Через n8n UI

1. Откройте: https://n8n.rentflow.rentals
2. **Workflows** → **Import from File**
3. Импортируйте по порядку:
   - `n8n-workflows/rentprog-exchange-rates-parser.json` (парсер)
   - `n8n-workflows/query-exchange-rates-tool.json` (инструмент)
   - `n8n-workflows/exchange-rates-ai-agent.json` (AI Agent)
   - `n8n-workflows/telegram-exchange-rates-bot.json` (Telegram бот)

#### Вариант B: Инструкция

```bash
node setup/import_exchange_rates_ai_system.mjs
```

Выведет подробную инструкцию по импорту.

---

### 3. Создать Credentials в n8n

#### PostgreSQL Neon

- **Name:** `PostgreSQL Neon`
- **Host:** `ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech`
- **Database:** `neondb`
- **User:** `neondb_owner`
- **Password:** `npg_cHIT9Kxfk1Am`
- **Port:** `5432`
- **SSL:** Require

#### OpenAI

- **Name:** `OpenAI`
- **API Key:** ваш ключ OpenAI (для gpt-4o-mini)

#### Telegram Main Bot

- **Name:** `Telegram Main Bot`
- **Access Token:** токен бота @test_geodrive_check_bot
  - Получите у @BotFather в Telegram

---

### 4. Связать workflows

#### В "Exchange Rates AI Assistant":
1. Откройте ноду **"Tool: Query Exchange Rates"**
2. В параметре **"Workflow ID"** выберите **"Query Exchange Rates Tool"**
3. **Save**

---

### 5. Настроить Telegram webhook

#### В "Telegram Exchange Rates Bot":
1. Откройте workflow
2. Скопируйте **Production URL** вебхука
3. Установите через @BotFather или API:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<PRODUCTION_URL>"
```

---

### 6. Активировать workflows

- ✅ **RentProg Exchange Rates Parser** - ON
- ✅ **Exchange Rates AI Assistant** - ON
- ✅ **Telegram Exchange Rates Bot** - ON
- ⚠️ **Query Exchange Rates Tool** - OFF (вызывается автоматически)

---

## 🧪 Тестирование

### 1. Проверить парсинг

Подождите 1 час или запустите вручную **"RentProg Exchange Rates Parser"**.

**Проверить данные:**
```sql
SELECT * FROM exchange_rates ORDER BY ts DESC LIMIT 5;
```

**Должно быть:**
```
| branch  | gel_to_usd | gel_to_eur | gel_to_rub | ts                  |
|---------|------------|------------|------------|---------------------|
| tbilisi | 0.3704     | 0.3450     | 0.0037     | 2025-11-08 10:00:00 |
```

---

### 2. Тестировать инструмент напрямую

```bash
node setup/query_exchange_rates.mjs tbilisi
```

**Вывод:**
```json
{
  "ok": true,
  "count": 1,
  "rates": [
    {
      "branch": "tbilisi",
      "gel_to_usd": 0.3704,
      "gel_to_eur": 0.345,
      "gel_to_rub": 0.0037,
      "usd_to_gel": 2.6998,
      "eur_to_gel": 2.8986,
      "rub_to_gel": 270.2703,
      "timestamp": "2025-11-08T10:00:00.000Z"
    }
  ]
}
```

**Все филиалы:**
```bash
node setup/query_exchange_rates.mjs all
```

**Конкретная дата:**
```bash
node setup/query_exchange_rates.mjs tbilisi 2025-11-07
```

---

### 3. Тестировать AI Agent через HTTP

```bash
curl -X POST https://n8n.rentflow.rentals/webhook/exchange-rates-ai-chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test_123",
    "chatInput": "Какой курс доллара?"
  }'
```

---

### 4. Тестировать Telegram бота

1. Откройте бота @test_geodrive_check_bot в Telegram
2. Отправьте: `/start`
3. Спросите: "Какой курс доллара?"
4. Должен прийти ответ с курсами

**Примеры вопросов:**
- "Какой курс евро?"
- "Покажи курсы по всем филиалам"
- "Какой был курс рубля вчера?"
- "Сколько GEL в одном долларе?"

---

## 📊 Мониторинг

### Проверить логи парсинга

```sql
SELECT * FROM events 
WHERE type LIKE 'exchange_rates%' 
ORDER BY ts DESC 
LIMIT 10;
```

### Проверить последние курсы

```sql
SELECT 
  branch,
  gel_to_usd,
  gel_to_eur,
  gel_to_rub,
  ts
FROM exchange_rates
ORDER BY ts DESC
LIMIT 10;
```

### Статистика парсинга

```sql
SELECT 
  branch,
  COUNT(*) as total_records,
  MAX(ts) as last_update,
  AVG(gel_to_usd) as avg_usd_rate
FROM exchange_rates
GROUP BY branch;
```

---

## 🔧 Настройка

### Изменить модель AI

В **"Exchange Rates AI Assistant"** → **"OpenAI Chat Model"**:
- Измените `model` на `gpt-4` (более точная, дороже)
- Или оставьте `gpt-4o-mini` (быстрая, дешевая)

### Изменить System Message

В **"Exchange Rates AI Assistant"** → **"AI Agent"** → **Options** → **System Message**:
```
Ты — помощник по курсам валют...
(ваш текст)
```

### Добавить филиалы

1. В **"RentProg Exchange Rates Parser"**:
   - Добавьте новые филиалы в **"Prepare Tbilisi"**
   - Сделайте параллельные ноды для каждого филиала
2. Обновите **System Message** в AI Agent

---

## 📝 Файлы проекта

### Workflows
- `n8n-workflows/rentprog-exchange-rates-parser.json` - парсер курсов
- `n8n-workflows/query-exchange-rates-tool.json` - инструмент SQL
- `n8n-workflows/exchange-rates-ai-agent.json` - AI Agent
- `n8n-workflows/telegram-exchange-rates-bot.json` - Telegram бот

### Миграции
- `setup/migrations/create_exchange_rates_table.sql` - SQL миграция
- `setup/run_exchange_rates_migration.mjs` - запуск миграции

### Инструменты
- `setup/query_exchange_rates.mjs` - CLI инструмент для запросов
- `setup/import_exchange_rates_ai_system.mjs` - инструкция по импорту

### Документация
- `EXCHANGE_RATES_AI_SYSTEM.md` - этот файл

---

## 🎯 Roadmap

### Фаза 1 (текущая) ✅
- [x] Создать таблицу БД
- [x] Workflow парсинга курсов (tbilisi)
- [x] AI Agent с Query Tool
- [x] Telegram бот

### Фаза 2
- [ ] Парсинг всех филиалов (batumi, kutaisi, service-center)
- [ ] История изменений курсов (графики)
- [ ] Уведомления при резких изменениях курса

### Фаза 3
- [ ] Интеграция с AmoCRM (курсы в сделках)
- [ ] Автоматический расчет стоимости в разных валютах
- [ ] API endpoint для получения курсов

---

## 🐛 Troubleshooting

### Парсер не работает

**Проверить:**
1. Токен RentProg актуален?
2. URL правильный: `https://web.rentprog.ru/company_profile`
3. Регулярки находят курсы?

**Логи:**
```sql
SELECT * FROM events WHERE type = 'exchange_rates.parse.failed' ORDER BY ts DESC LIMIT 10;
```

### AI Agent не отвечает

**Проверить:**
1. OpenAI API ключ валиден?
2. Workflow "Query Exchange Rates Tool" правильно связан?
3. Chat Trigger webhook доступен?

**Тест:**
```bash
curl https://n8n.rentflow.rentals/webhook/exchange-rates-ai-chat
```

### Telegram бот молчит

**Проверить:**
1. Webhook установлен в Telegram?
2. Credentials "Telegram Main Bot" правильные?
3. Бот активирован?

**Проверка webhook:**
```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

---

## 📞 Контакты

Вопросы и предложения: создайте issue в репозитории

---

**Последнее обновление:** 2025-11-08  
**Версия:** 1.0.0

