# 🤖 Telegram Bot с встроенным AI Agent - Ручной импорт

**Дата:** 2025-11-08  
**Статус:** Готов к импорту через UI

---

## ⚠️ ВАЖНО: Почему ручной импорт?

**n8n MCP API не поддерживает AI Agent special connections** (`ai_languageModel`, `ai_tool`)

- ✅ Можно импортировать через **UI** (Import from File)
- ❌ Нельзя импортировать через **MCP/REST API**

---

## 📦 Что делает workflow:

```
Telegram Bot
    ↓
[Process Message] → /start? → [Send Command Response]
    ↓ (не команда)
[AI Agent] ← [OpenAI Model]
    ↓         ↑
    ↓    [Tool: Query Exchange Rates]
    ↓
[Send Response] → Telegram
```

**Полный цикл:**
1. Пользователь пишет в Telegram
2. Бот получает сообщение
3. AI Agent обрабатывает запрос
4. AI Agent вызывает Tool (Query Exchange Rates)
5. Tool запрашивает БД
6. AI Agent форматирует ответ
7. Бот отправляет ответ в Telegram

---

## 🚀 Импорт (3 минуты):

### Шаг 1: Открыть n8n UI

```
https://n8n.rentflow.rentals
```

### Шаг 2: Импортировать workflow

1. Нажмите **"+"** (Add workflow)
2. Выберите **"Import from File"**
3. Загрузите файл: `n8n-workflows/telegram-exchange-rates-bot.json`
4. Нажмите **"Import"**

### Шаг 3: Проверить credentials

После импорта проверьте, что подключены:

1. **Telegram Trigger** → Credentials: `Telegram account` ✅
2. **Send Response** → Credentials: `Telegram account` ✅
3. **Send Command Response** → Credentials: `Telegram account` ✅
4. **OpenAI Chat Model** → Credentials: `OpenAi account` ✅
5. **Tool** → workflowId: `CsiMxujfHQZvB8b4` ✅

### Шаг 4: Сохранить

Нажмите **"Save"** в правом верхнем углу

---

## ✅ Проверка connections:

Откройте workflow и проверьте connections:

### Main Flow (зеленые линии):
```
Telegram Trigger → Process Message → Is Command? 
    ↓ (false)                    ↓ (true)
AI Agent → Send Response         Send Command Response
```

### AI Connections (синие/фиолетовые линии):
```
OpenAI Chat Model ─ai_languageModel─> AI Agent
Tool: Query Exchange Rates ─ai_tool─> AI Agent
```

**Должно быть:**
- 4 main connections
- 2 AI connections
- **Всего: 6 connections**

---

## 🔧 Активация:

### 1. Активировать workflow

Нажмите toggle **"Active"** в правом верхнем углу

### 2. Получить webhook URL

1. Кликните на **"Telegram Trigger"** ноду
2. Скопируйте **"Webhook URL"**
3. Должен быть вида:
   ```
   https://n8n.rentflow.rentals/webhook-test/telegram-exchange-bot
   ```

### 3. Установить webhook в Telegram

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<WEBHOOK_URL>"
```

**Проверить:**
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

**Ожидаемый ответ:**
```json
{
  "ok": true,
  "result": {
    "url": "https://n8n.rentflow.rentals/webhook-test/telegram-exchange-bot",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

---

## 🧪 Тестирование:

### 1. Открыть бота в Telegram

Найдите своего бота и откройте чат

### 2. Отправить /start

```
/start
```

**Ожидаемый ответ:**
```
💱 Привет! Я помощник по курсам валют RentProg.

Спроси меня:
- Какой курс доллара?
- Покажи курсы по всем филиалам
- Какой был курс евро вчера?
```

### 3. Спросить о курсах

```
Какой курс доллара?
```

**Что должно произойти:**
1. Бот получит сообщение
2. AI Agent вызовет Tool: Query Exchange Rates
3. Tool запросит БД
4. AI Agent сформирует ответ
5. Бот отправит ответ

**Ожидаемый ответ:**
```
💱 Текущий курс доллара в Тбилиси:

GEL → USD: 0.3704
USD → GEL: 2.6998

Данные обновлены: 2025-11-08 10:00:00
```

---

## 🔍 Отладка:

### Если бот не отвечает:

1. **Проверить workflow активирован:**
   - https://n8n.rentflow.rentals/workflow/JPjbUVK3ttvDIPAY
   - Toggle **"Active"** должен быть включен

2. **Проверить webhook установлен:**
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
   ```

3. **Проверить executions:**
   - https://n8n.rentflow.rentals/workflow/JPjbUVK3ttvDIPAY/executions
   - Найдите последний запуск
   - Проверьте ошибки в нодах

4. **Проверить credentials:**
   - Telegram account - токен правильный?
   - OpenAi account - API key валиден?

5. **Проверить Tool workflow:**
   - https://n8n.rentflow.rentals/workflow/CsiMxujfHQZvB8b4
   - Убедитесь что он существует
   - НЕ нужно активировать (вызывается автоматически)

### Если AI Agent не вызывает Tool:

1. **Проверить connections:**
   - Откройте workflow
   - Проверьте что Tool подключен к AI Agent через `ai_tool`

2. **Проверить toolDescription:**
   - Откройте Tool ноду
   - Должно быть: "Используй этот инструмент для получения..."

3. **Проверить OpenAI Chat Model:**
   - Model: `gpt-4o-mini`
   - Temperature: `0.3`
   - Credentials: `OpenAi account`

---

## 📊 Мониторинг:

### Executions

Посмотреть все запуски:
```
https://n8n.rentflow.rentals/workflow/JPjbUVK3ttvDIPAY/executions
```

### Логи в БД

**События от бота:**
```sql
SELECT * FROM events 
WHERE type LIKE 'telegram.exchange_bot%' 
ORDER BY ts DESC 
LIMIT 10;
```

### Статистика вопросов

```sql
-- Создать таблицу (если еще нет)
CREATE TABLE IF NOT EXISTS telegram_bot_logs (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  chat_id BIGINT NOT NULL,
  username TEXT,
  question TEXT,
  response TEXT,
  tool_used BOOLEAN DEFAULT FALSE
);

-- Статистика
SELECT 
  COUNT(*) as total_questions,
  COUNT(CASE WHEN tool_used THEN 1 END) as with_tool,
  COUNT(DISTINCT chat_id) as unique_users
FROM telegram_bot_logs
WHERE ts > NOW() - INTERVAL '7 days';
```

---

## 📝 Чек-лист:

### Импорт:
- [ ] Открыть n8n UI
- [ ] Import from File → `telegram-exchange-rates-bot.json`
- [ ] Проверить credentials (4 ноды)
- [ ] Проверить connections (6 total)
- [ ] Сохранить workflow

### Активация:
- [ ] Активировать workflow (toggle Active)
- [ ] Скопировать Webhook URL
- [ ] Установить webhook в Telegram
- [ ] Проверить `getWebhookInfo`

### Тестирование:
- [ ] Отправить `/start` → получить приветствие
- [ ] Спросить "Какой курс доллара?" → получить ответ с курсами
- [ ] Проверить executions в n8n UI
- [ ] Проверить что Tool вызвался

---

## 🎉 Готово!

После импорта и активации бот полностью готов к работе.

**Полная документация:** `EXCHANGE_RATES_SYSTEM_READY.md`

---

**Последнее обновление:** 2025-11-08 12:30  
**Версия:** 2.0.0 (Embedded AI Agent)

