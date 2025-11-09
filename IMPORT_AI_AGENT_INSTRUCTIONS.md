# 📋 Инструкция по импорту AI Agent

## ✅ Уже создано через MCP:

### 1. Query Exchange Rates Tool ✅
- **ID:** `CsiMxujfHQZvB8b4`
- **URL:** https://n8n.rentflow.rentals/workflow/CsiMxujfHQZvB8b4
- **Статус:** Создан, credentials подключены

### 2. Telegram Exchange Rates Bot ✅
- **ID:** `JPjbUVK3ttvDIPAY`
- **URL:** https://n8n.rentflow.rentals/workflow/JPjbUVK3ttvDIPAY
- **Статус:** Создан, credentials подключены

---

## ⚠️ Требуется импорт через UI:

### 3. Exchange Rates AI Assistant

**Файл:** `n8n-workflows/exchange-rates-ai-agent.json`

**Причина:** AI Agent с Chat Trigger требует специальные connections (`ai_agent`, `ai_tool`), которые не поддерживаются через MCP API.

---

## 🔧 Шаги импорта:

### 1. Откройте n8n UI
https://n8n.rentflow.rentals

### 2. Импортируйте workflow
1. **Workflows** → **+** (Add) → **Import from File**
2. Выберите файл: `n8n-workflows/exchange-rates-ai-agent.json`
3. **Import**

### 3. Проверьте credentials

Workflow автоматически подключит:
- ✅ **"OpenAi account"** - для OpenAI Chat Model
- ℹ️ **Workflow ID** уже установлен на `CsiMxujfHQZvB8b4` (Query Exchange Rates Tool)

**Если OpenAI credential не найден:**
1. **Credentials** → **Add Credential** → **OpenAI**
2. Укажите API Key
3. **Name:** `OpenAi account` (именно так, как показано на скрине)
4. **Save**

### 4. Проверьте workflow

Откройте **"Exchange Rates AI Assistant"** и убедитесь:

**Нода "Tool: Query Exchange Rates":**
- ✅ Параметр `workflowId` = `CsiMxujfHQZvB8b4`
- ✅ Параметр `mode` = `id`

**Нода "OpenAI Chat Model":**
- ✅ Credential = `OpenAi account`
- ✅ Model = `gpt-4o-mini`
- ✅ Temperature = `0.3`

**Connections:**
- ✅ `When chat message received` → `AI Agent` (main)
- ✅ `AI Agent` → `OpenAI Chat Model` (ai_languageModel)
- ✅ `AI Agent` → `Tool: Query Exchange Rates` (ai_tool)

---

## 🚀 Активация workflows

### 1. RentProg Exchange Rates Parser
- **ID:** `VggQLPapIgWHeBl0`
- **URL:** https://n8n.rentflow.rentals/workflow/VggQLPapIgWHeBl0
- **Действие:** Активировать (toggle ON)
- **Триггер:** Schedule (каждый час)

### 2. Query Exchange Rates Tool
- **ID:** `CsiMxujfHQZvB8b4`
- **Действие:** Оставить ВЫКЛЮЧЕННЫМ (вызывается автоматически)

### 3. Exchange Rates AI Assistant
- **После импорта:** Активировать (toggle ON)
- **Триггер:** Chat Trigger (webhook)

### 4. Telegram Exchange Rates Bot
- **ID:** `JPjbUVK3ttvDIPAY`
- **URL:** https://n8n.rentflow.rentals/workflow/JPjbUVK3ttvDIPAY
- **Действие:** Активировать (toggle ON)
- **Webhook URL:** Скопировать из Production URL

---

## 🔗 Настройка Telegram webhook

### Получить Production URL:
1. Откройте: https://n8n.rentflow.rentals/workflow/JPjbUVK3ttvDIPAY
2. Кликните на ноду **"Telegram Trigger"**
3. Скопируйте **Production URL**

### Установить webhook:
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<PRODUCTION_URL>"
```

**Или через @BotFather:**
1. Откройте @BotFather в Telegram
2. `/setwebhook`
3. Выберите бота
4. Вставьте Production URL

**Проверить webhook:**
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

---

## 🧪 Тестирование

### 1. Проверить парсинг курсов
Запустите вручную **"RentProg Exchange Rates Parser"** или подождите 1 час.

**Проверить данные:**
```sql
SELECT * FROM exchange_rates ORDER BY ts DESC LIMIT 5;
```

### 2. Тестировать Query Tool напрямую
```bash
node setup/query_exchange_rates.mjs tbilisi
```

### 3. Тестировать AI Agent через HTTP
```bash
curl -X POST https://n8n.rentflow.rentals/webhook/exchange-rates-ai-chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test_123",
    "chatInput": "Какой курс доллара?"
  }'
```

### 4. Тестировать Telegram бота
1. Откройте бота в Telegram
2. Отправьте: `/start`
3. Спросите: "Какой курс доллара?"

---

## 📊 Статус импорта

- [x] Query Exchange Rates Tool - создан через MCP ✅
- [x] Telegram Exchange Rates Bot - создан через MCP ✅
- [ ] Exchange Rates AI Assistant - **импортируйте через UI** ⚠️
- [x] RentProg Exchange Rates Parser - создан ранее ✅

---

## 💡 Подсказки

### Если AI Agent не отвечает:
1. Проверьте Chat Trigger webhook доступен
2. Убедитесь что OpenAI API key валиден
3. Проверьте что workflowId правильный (`CsiMxujfHQZvB8b4`)

### Если Telegram бот молчит:
1. Webhook должен быть установлен
2. Credentials "Telegram account" должны быть правильные
3. Workflow должен быть активирован

### Если парсер не работает:
1. Токен RentProg актуален?
2. URL правильный: `https://web.rentprog.ru/company_profile`
3. Регулярки находят курсы?

---

## ✅ Готово!

После импорта AI Agent через UI система будет полностью готова к работе! 🎉

