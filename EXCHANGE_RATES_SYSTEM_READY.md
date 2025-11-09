# ✅ Exchange Rates AI System - Готово к запуску!

**Дата:** 2025-11-08  
**Статус:** Все workflows созданы и исправлены через MCP

---

## 📦 Что создано:

### 1. Query Exchange Rates Tool ✅
- **ID:** `CsiMxujfHQZvB8b4`
- **URL:** https://n8n.rentflow.rentals/workflow/CsiMxujfHQZvB8b4
- **Статус:** Готов, credentials подключены
- **Действие:** Оставить ВЫКЛЮЧЕННЫМ (вызывается автоматически)

### 2. Exchange Rates AI Assistant ✅
- **ID:** `z1b7wIj17ppMuU7a`
- **URL:** https://n8n.rentflow.rentals/workflow/z1b7wIj17ppMuU7a
- **Статус:** ✅ ИСПРАВЛЕН через MCP
- **Исправления:**
  - ✅ OpenAI Model: `gpt-4o-mini`
  - ✅ OpenAI Credentials: подключены
  - ✅ Tool Description: добавлено
  - ✅ Fields Descriptions: добавлены
  - ✅ Settings: полные
- **Валидация:** `valid: true`, 0 ошибок
- **Действие:** **АКТИВИРОВАТЬ**

### 3. Telegram Exchange Rates Bot ✅
- **ID:** `JPjbUVK3ttvDIPAY`
- **URL:** https://n8n.rentflow.rentals/workflow/JPjbUVK3ttvDIPAY
- **Статус:** Готов, credentials подключены
- **Действие:** **АКТИВИРОВАТЬ** + настроить webhook

### 4. RentProg Exchange Rates Parser ✅
- **ID:** `VggQLPapIgWHeBl0`
- **URL:** https://n8n.rentflow.rentals/workflow/VggQLPapIgWHeBl0
- **Статус:** Создан ранее
- **Действие:** **АКТИВИРОВАТЬ**

---

## 🚀 Активация (5 минут):

### Шаг 1: Активировать workflows

Откройте каждый workflow и нажмите **Active** toggle:

1. ✅ **RentProg Exchange Rates Parser** (VggQLPapIgWHeBl0)
   - Триггер: Schedule (каждый час)
   - Парсит курсы с https://web.rentprog.ru/company_profile

2. ⚠️ **Query Exchange Rates Tool** (CsiMxujfHQZvB8b4)
   - **Оставить ВЫКЛЮЧЕННЫМ** (вызывается автоматически AI Agent)

3. ✅ **Exchange Rates AI Assistant** (z1b7wIj17ppMuU7a)
   - Триггер: Chat Trigger (webhook)
   - URL: https://n8n.rentflow.rentals/webhook/exchange-rates-ai-chat

4. ✅ **Telegram Exchange Rates Bot** (JPjbUVK3ttvDIPAY)
   - Триггер: Telegram Trigger (webhook)

---

### Шаг 2: Настроить Telegram webhook

#### Получить Production URL:
1. Откройте: https://n8n.rentflow.rentals/workflow/JPjbUVK3ttvDIPAY
2. Кликните на ноду **"Telegram Trigger"**
3. Скопируйте **Production URL**

#### Установить webhook:
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<PRODUCTION_URL>"
```

**Проверить:**
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

Должно вернуть:
```json
{
  "ok": true,
  "result": {
    "url": "https://n8n.rentflow.rentals/webhook-test/...",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

---

## 🧪 Тестирование:

### 1. Проверить парсинг курсов

**Вариант A: Запустить вручную**
1. Откройте: https://n8n.rentflow.rentals/workflow/VggQLPapIgWHeBl0
2. Нажмите **"Execute Workflow"**
3. Проверьте результат

**Вариант B: Подождать 1 час**
- Workflow запустится автоматически

**Проверить данные в БД:**
```sql
SELECT * FROM exchange_rates ORDER BY ts DESC LIMIT 5;
```

**Ожидаемый результат:**
```
| branch  | gel_to_usd | gel_to_eur | gel_to_rub | ts                  |
|---------|------------|------------|------------|---------------------|
| tbilisi | 0.3704     | 0.3450     | 0.0037     | 2025-11-08 10:00:00 |
```

---

### 2. Тестировать Query Tool напрямую

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

**Ожидаемый ответ:**
```json
{
  "output": "💱 Текущий курс доллара в Тбилиси:\n\nGEL → USD: 0.3704\nUSD → GEL: 2.6998\n\nДанные обновлены: 2025-11-08 10:00:00",
  "sessionId": "test_123"
}
```

---

### 4. Тестировать Telegram бота

1. Откройте бота в Telegram
2. Отправьте: `/start`
3. Должен прийти ответ:
   ```
   💱 Привет! Я помощник по курсам валют RentProg.

   Спроси меня:
   - Какой курс доллара?
   - Покажи курсы по всем филиалам
   - Какой был курс евро вчера?
   ```

4. Спросите: "Какой курс доллара?"
5. AI Agent должен:
   - Вызвать Query Exchange Rates Tool
   - Получить данные из БД
   - Сформировать ответ с курсами

**Примеры вопросов:**
- "Какой курс евро?"
- "Покажи курсы по всем филиалам"
- "Какой был курс рубля вчера?"
- "Сколько GEL в одном долларе?"

---

## 📊 Мониторинг:

### Проверить executions

**AI Agent:**
```
https://n8n.rentflow.rentals/workflow/z1b7wIj17ppMuU7a/executions
```

**Telegram Bot:**
```
https://n8n.rentflow.rentals/workflow/JPjbUVK3ttvDIPAY/executions
```

**Parser:**
```
https://n8n.rentflow.rentals/workflow/VggQLPapIgWHeBl0/executions
```

---

### Проверить логи в БД

**События парсинга:**
```sql
SELECT * FROM events 
WHERE type LIKE 'exchange_rates%' 
ORDER BY ts DESC 
LIMIT 10;
```

**Последние курсы:**
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

**Статистика:**
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

## 🔧 Troubleshooting:

### AI Agent не отвечает

**Проверить:**
1. Workflow активирован?
2. OpenAI API key валиден?
3. Chat Trigger webhook доступен?

**Тест webhook:**
```bash
curl https://n8n.rentflow.rentals/webhook/exchange-rates-ai-chat
```

**Проверить executions:**
- Откройте executions AI Agent
- Найдите последний запуск
- Проверьте ошибки в нодах

---

### Telegram бот молчит

**Проверить:**
1. Webhook установлен?
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
   ```

2. Credentials "Telegram account" правильные?
   - Откройте Credentials в n8n
   - Проверьте токен

3. Workflow активирован?
   - https://n8n.rentflow.rentals/workflow/JPjbUVK3ttvDIPAY

---

### Парсер не работает

**Проверить:**
1. Токен RentProg актуален?
   - Откройте workflow
   - Нода "Prepare Tbilisi"
   - Проверьте токен

2. URL правильный?
   ```
   https://web.rentprog.ru/company_profile
   ```

3. Регулярки находят курсы?
   - Запустите вручную
   - Проверьте ноду "Parse Exchange Rates"
   - Смотрите console.log

**Логи ошибок:**
```sql
SELECT * FROM events 
WHERE type = 'exchange_rates.parse.failed' 
ORDER BY ts DESC 
LIMIT 10;
```

---

## 📝 Итоговый чек-лист:

### Workflows:
- [x] Query Exchange Rates Tool - создан ✅
- [x] Exchange Rates AI Assistant - создан и исправлен ✅
- [x] Telegram Exchange Rates Bot - создан ✅
- [x] RentProg Exchange Rates Parser - создан ✅

### Credentials:
- [x] PostgreSQL Neon - подключен ✅
- [x] OpenAI - подключен ✅
- [x] Telegram - подключен ✅

### Активация:
- [ ] RentProg Exchange Rates Parser - **активировать**
- [ ] Exchange Rates AI Assistant - **активировать**
- [ ] Telegram Exchange Rates Bot - **активировать**
- [ ] Telegram webhook - **настроить**

### Тестирование:
- [ ] Парсинг курсов - запустить вручную
- [ ] Query Tool - протестировать через CLI
- [ ] AI Agent - протестировать через HTTP
- [ ] Telegram бот - протестировать через Telegram

---

## 🎉 Готово!

Система полностью создана и исправлена через MCP.

**Осталось только:**
1. Активировать 3 workflows (3 клика)
2. Настроить Telegram webhook (1 команда)
3. Протестировать (5 минут)

**Полная документация:** `EXCHANGE_RATES_AI_SYSTEM.md`

---

**Последнее обновление:** 2025-11-08 12:20  
**Версия:** 1.0.0 (Production Ready)

