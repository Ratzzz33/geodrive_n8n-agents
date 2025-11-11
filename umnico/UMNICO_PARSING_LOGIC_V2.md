# 🔄 Umnico Parsing Logic V2 - Улучшенная логика парсинга

**Дата создания:** 2025-11-11  
**Статус:** ✅ Реализовано в `services/playwright-umnico-optimized.ts`

---

## 🎯 Цель

Создать **полную историю всех диалогов** с клиентами (Telegram + WhatsApp) для:
- Агента клиентских чатов (Umnico bridge)
- Ночного агента продаж (RAG из победных диалогов)
- Анализа качества работы отдела продаж
- Контроля SLA по ответам клиентам

---

## 📊 Новая логика парсинга: x/y

### Правило 1: x < y → ✅ Всё получили успешно

**Когда:**
- `loaded < total` (например, получили 50 из 100)

**Что делаем:**
- ✅ Считаем парсинг **успешным**
- Сохраняем все сообщения в БД
- `incomplete = false`

**Пример:**
```
💬 Initial load: 50 messages (total in UI: 100)
✅ loaded < total (50/100) - complete!
```

---

### Правило 2: x = y → 🔄 Прокручиваем вверх

**Когда:**
- `loaded = total` (например, 100 из 100)

**Что делаем:**
1. 🔄 Пытаемся прокрутить контейнер сообщений вверх
2. Ждём подгрузки старых сообщений (2 секунды)
3. Повторяем до 10 попыток
4. Если после прокрутки `loaded < total` → ✅ успех!
5. Если после всех попыток всё ещё `loaded = total` → ⚠️ помечаем `incomplete = true`

**Пример успешной прокрутки:**
```
🔄 loaded = total (100/100), attempting to scroll up...
   ✅ Loaded 50 more messages (total: 150)
   ✅ Loaded 30 more messages (total: 180)
✅ Success! loaded < total (180/200)
```

**Пример неудачной прокрутки:**
```
🔄 loaded = total (100/100), attempting to scroll up...
⚠️  Could not load more messages after 10 attempts
⚠️  INCOMPLETE - needs manual processing via MCP Chrome
```

---

### Правило 3: Не удалось определить total → ⚠️ Incomplete

**Когда:**
- Не смогли найти счётчик сообщений в UI

**Что делаем:**
- ⚠️ Помечаем `incomplete = true`
- Логируем для ручной обработки

**Пример:**
```
⚠️  Could not determine total from UI, marking as incomplete
```

---

## 👤 Клиенты без телефона (Telegram)

### Новая логика определения клиента

**Telegram клиенты:**
- Нет номера телефона в UI
- Есть username или имя в заголовке
- Канал: `telegram`

**Как определяем:**
1. Ищем ссылку `a[href*="tel:"]` → если есть, это телефон
2. Если нет телефона → ищем Telegram username в заголовке:
   - Формат `@username` → извлекаем `username`
   - Просто текст без символа `+` → считаем Telegram username
3. Определяем канал из источника (`.im-source-item`)

**Структура данных:**
```typescript
{
  clientPhone: "+995599001665" | null,  // WhatsApp
  clientTelegram: "john_doe" | null,    // Telegram
  channel: "whatsapp" | "telegram" | "instagram",
  channelAccount: "995599001665"        // номер WhatsApp аккаунта
}
```

---

## 🗄️ Сохранение в БД

### Таблица `clients`

**Поля:**
```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  name TEXT,
  phone TEXT,                    -- для WhatsApp клиентов
  telegram_username TEXT,        -- для Telegram клиентов
  email TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- Индексы
CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_clients_telegram ON clients(telegram_username);
```

**Логика upsert:**
```javascript
// WhatsApp клиент (есть телефон)
if (clientPhone) {
  // Ищем по phone
  // Обновляем или создаём с phone
}

// Telegram клиент (нет телефона)
if (!clientPhone && clientTelegram) {
  // Ищем по telegram_username
  // Обновляем или создаём с telegram_username
}
```

---

## 📋 API Response

### Расширенный формат ответа

**Старый формат:**
```json
{
  "ok": true,
  "conversationId": "61965921",
  "count": 42,
  "data": [...]
}
```

**Новый формат V2:**
```json
{
  "ok": true,
  "conversationId": "61965921",
  "count": 42,
  "total": 50,                    // общее количество в UI
  "incomplete": false,             // нужна ли ручная доработка
  "channel": "whatsapp",           // whatsapp | telegram | instagram
  "channelAccount": "995599001665", // номер аккаунта
  "clientPhone": "+995599001665",  // для WhatsApp
  "clientTelegram": null,          // для Telegram
  "data": [...]
}
```

---

## 🔧 Реализация

### Файлы

1. **`services/playwright-umnico-optimized.ts`**
   - ✅ Метод `getMessagesViaUI()` - парсинг через UI с новой логикой
   - ✅ Метод `getMessagesViaAPI()` - парсинг через API с fallback на UI
   - ✅ Метод `getMessages()` - умный выбор метода
   - ✅ Express endpoint `/api/conversations/:id/messages` - возвращает расширенный формат

2. **`setup/sync_umnico_conversations.mjs`**
   - 🔜 Обновить для обработки `incomplete` флага
   - 🔜 Добавить сохранение Telegram клиентов

3. **`sql/conversations_schema.sql`**
   - ✅ Миграция добавляет `telegram_username` в `clients`

---

## 🚀 Деплой

### Шаг 1: Применить миграцию БД

```bash
cd C:\Users\33pok\geodrive_n8n-agents

# Проверить есть ли поле telegram_username
node setup/check_clients_structure.mjs

# Если нет - применить миграцию
psql $DATABASE_URL -f sql/conversations_schema.sql
```

### Шаг 2: Собрать TypeScript

```bash
npm run build
```

### Шаг 3: Задеплоить на сервер

```bash
python deploy_fixes_now.py
```

Или вручную:
```bash
ssh root@46.224.17.15
cd /root/geodrive_n8n-agents
git pull
npm run build
docker compose restart playwright-umnico
```

### Шаг 4: Проверить работу

```bash
# Проверить health
curl http://46.224.17.15:3001/health

# Получить сообщения диалога (тест)
curl http://46.224.17.15:3001/api/conversations/61965921/messages
```

---

## 📊 Мониторинг

### Проверка incomplete диалогов

```sql
-- Диалоги помеченные как неполные
SELECT 
  id,
  umnico_conversation_id,
  metadata->>'client_name' as client,
  metadata->>'incomplete' as incomplete,
  metadata->>'loaded' as loaded,
  metadata->>'total' as total,
  last_message_at
FROM conversations
WHERE metadata->>'incomplete' = 'true'
ORDER BY last_message_at DESC;
```

### Проверка Telegram клиентов

```sql
-- Клиенты без телефона (Telegram)
SELECT 
  id,
  name,
  telegram_username,
  created_at
FROM clients
WHERE phone IS NULL 
  AND telegram_username IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;
```

---

## 🔄 Ручная доработка через MCP Chrome

Для диалогов с `incomplete = true`:

### Вариант 1: Автоматический retry

```javascript
// В n8n workflow
if (conversation.incomplete) {
  // Запланировать повторную попытку через 1 час
  // Возможно, сообщения подгрузятся позже
}
```

### Вариант 2: Ручная обработка через MCP Chrome

```javascript
// Использовать MCP Chrome для ручной прокрутки
import { mcp_chrome_devtools_navigate } from '@cursor/mcp';

// 1. Открыть диалог
await mcp_chrome_devtools_navigate({
  url: `https://umnico.com/app/inbox/deals/inbox/details/${conversationId}`
});

// 2. Прокрутить вверх вручную
await mcp_chrome_devtools_evaluate({
  expression: `
    const container = document.querySelector('.im-stack__messages');
    container.scrollTop = 0;
  `
});

// 3. Подождать подгрузки
await new Promise(resolve => setTimeout(resolve, 3000));

// 4. Получить все сообщения
const messages = await mcp_chrome_devtools_evaluate({
  expression: `
    Array.from(document.querySelectorAll('.im-stack__messages-item-wrap'))
      .map(wrap => ({
        text: wrap.querySelector('.im-message__text')?.textContent,
        time: wrap.querySelector('.im-info__date')?.textContent
      }))
  `
});
```

---

## ✅ Checklist

- [x] Реализована логика x < y / x = y / incomplete
- [x] Добавлена поддержка Telegram клиентов
- [x] Обновлён API response с расширенными полями
- [x] Миграция БД для `telegram_username`
- [x] Документация создана
- [ ] Обновить `sync_umnico_conversations.mjs` для обработки incomplete
- [ ] Обновить `sync_umnico_conversations.mjs` для сохранения Telegram клиентов
- [ ] Протестировать на реальных данных
- [ ] Задеплоить на продакшн

---

## 📝 Примечания

### Почему важна логика x < y?

В Umnico есть лимит на загрузку сообщений в UI (обычно 30-50 за раз). Когда мы видим `loaded < total`, это значит что:
- ✅ UI успешно показал нам **часть** истории
- ✅ Остальные сообщения подгрузятся при прокрутке
- ✅ Мы можем безопасно считать, что получили все **видимые** сообщения

Когда `loaded = total`, это может означать:
- ⚠️ Мы на "дне" списка (самые свежие сообщения)
- ⚠️ Нужно прокрутить вверх для получения старых сообщений
- ⚠️ Или это действительно все сообщения (редко)

### Почему Telegram клиенты без телефона?

Telegram не требует номер телефона для использования (можно только username). Поэтому:
- WhatsApp → всегда есть номер телефона
- Telegram → может быть только username
- Instagram → может быть только username

Мы должны поддерживать все варианты для полной истории.

---

**Автор:** Claude (Cursor Agent)  
**Последнее обновление:** 2025-11-11

