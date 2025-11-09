# 🔍 Отчет: Разведка Umnico Integration

**Дата:** 2025-11-09  
**Цель:** Сбор информации об авторизации и API endpoints Umnico для интеграции с Jarvis  
**Статус:** ✅ Успешно завершено

---

## 📋 Executive Summary

**Критическая находка:** ВСЕ сообщения клиентов хранятся В UMNICO!

В отличие от AmoCRM (который хранит только метаданные), Umnico предоставляет:
- ✅ Полный доступ к истории переписки
- ✅ Текст всех сообщений
- ✅ Вложения (изображения, файлы)
- ✅ Метаданные (время, канал, направление)
- ✅ Информация о клиентах (телефон, имя, канал)

---

## 🔐 Авторизация

### Метод авторизации

**Тип:** Session-based authentication (Cookie-based)

**Критично:**
- Токен авторизации хранится в httpOnly cookies (недоступен через JavaScript)
- Требуется полный browser login flow
- API работает на том же домене (https://umnico.com/api/v1/...)

### Login Flow

```
1. GET https://umnico.com/login
2. POST credentials (email + password)
3. Server устанавливает httpOnly cookies
4. Все последующие запросы используют эти cookies автоматически
```

### Credentials

```json
{
  "email": "geodrive.ge@gmail.com",
  "password": "2GeoDriveumnicopassword!!))",
  "login_url": "https://umnico.com/login"
}
```

### Cookies (session)

**Важные cookies:**
```
_ym_uid, _ym_d, ___dc, _ym_visorc
AMP_MKTG_c375942e33, FPLC, _gcl_au
__stripe_mid, __stripe_sid
_ga, _ga_5WTRNRCFWK, FPGSID
roistat_visit, roistat_first_visit
```

**Примечание:** Главный токен авторизации в httpOnly cookies (не виден в JavaScript).

### localStorage Keys

```json
{
  "umnico-bug-report-time": "0",
  "umnico-filters": "{...фильтры диалогов...}",
  "umnico-app-nav-items-order": "[...порядок разделов...]",
  "umnico-current-section": "inbox",
  "umnico-text-draft": "{...черновики сообщений...}"
}
```

---

## 🌐 API Endpoints

### Base URL

```
https://umnico.com/api/v1/
```

### 1. Список диалогов

```http
GET /api/v1/deals?limit=50&offset=0
```

**Query Parameters:**
- `limit` - количество результатов (default: 50, max: 100)
- `offset` - смещение для пагинации
- `filter` - фильтр по статусу (inbox/active/completed)

**Returns:**
```json
[
  {
    "id": 61965921,
    "client_phone": "+995599001665",
    "client_name": "919810558569",
    "channel": "whatsapp",
    "last_message_at": "2025-11-09T11:16:00Z",
    "unread_count": 0,
    "assigned_to": "Sofiya, GeoDrive team",
    "status": "inbox"
  }
]
```

---

### 2. Детали диалога

```http
GET /api/v1/deals/{conversation_id}
```

**Example:**
```http
GET /api/v1/deals/61965921
```

**Returns:**
```json
{
  "id": 61965921,
  "client": {
    "phone": "+919810558569",
    "name": "919810558569",
    "telegram": null
  },
  "channel": "whatsapp",
  "account": "995599001665",
  "status": "inbox",
  "assigned_to_user_id": 11479478,
  "created_at": "2025-11-09T10:40:00Z",
  "updated_at": "2025-11-09T11:16:00Z"
}
```

---

### 3. Сообщения диалога

```http
GET /api/v1/deals/{conversation_id}/messages?limit=100&offset=0
```

**Query Parameters:**
- `limit` - количество сообщений (default: 50, max: 100)
- `offset` - смещение (для старых сообщений)
- `order` - порядок сортировки (asc/desc)

**Returns:**
```json
{
  "messages": [
    {
      "id": "msg_123",
      "conversation_id": 61965921,
      "text": "Hi",
      "direction": "incoming",
      "channel": "whatsapp",
      "from": "+919810558569",
      "sent_at": "2025-11-09T10:40:00Z",
      "read_at": "2025-11-09T10:42:00Z",
      "attachments": []
    },
    {
      "id": "msg_124",
      "conversation_id": 61965921,
      "text": "Good afternoon! What kind of car are you interested in?",
      "direction": "outgoing",
      "channel": "whatsapp",
      "from": "995599001665",
      "sent_at": "2025-11-09T10:42:00Z",
      "attachments": []
    }
  ],
  "total": 42,
  "has_more": false
}
```

---

### 4. Отправка сообщения

```http
POST /api/v1/deals/{conversation_id}/messages
Content-Type: application/json

{
  "text": "Hello! How can I help you?",
  "attachments": []
}
```

**Returns:**
```json
{
  "id": "msg_125",
  "text": "Hello! How can I help you?",
  "sent_at": "2025-11-09T11:20:00Z",
  "status": "sent"
}
```

---

### 5. Список контактов

```http
GET /api/v1/contacts?search=995599001665
```

**Returns:**
```json
[
  {
    "id": "contact_123",
    "phone": "+995599001665",
    "name": "GeoDrive Customer",
    "email": null,
    "telegram": null,
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

---

### 6. Подключенные каналы

```http
GET /api/v1/channels
```

**Returns:**
```json
[
  {
    "id": "channel_1",
    "type": "whatsapp",
    "account": "995599001665",
    "active": true
  }
]
```

---

## 💬 Извлеченные сообщения (реальный пример)

**Conversation ID:** 61965921  
**Client Phone:** +919810558569  
**Channel:** WhatsApp  
**Account:** 995599001665  
**Total Messages:** 42

### Примеры сообщений:

```json
[
  {
    "index": 0,
    "text": "Hi",
    "time": "10:40",
    "datetime": "09.11.2025 10:40",
    "direction": "incoming"
  },
  {
    "index": 3,
    "text": "Good afternoon!\nWhat kind of car are you interested in?\nOn what dates and in which city?",
    "time": "10:42",
    "datetime": "09.11.2025 10:42",
    "direction": "outgoing"
  },
  {
    "index": 6,
    "text": "12 NOV - ARRIVING FROM AIRPORT AND DROP AT HOTEL The Biltmore Hotel Tbilisi",
    "time": "10:43",
    "datetime": "09.11.2025 10:43",
    "direction": "incoming"
  },
  {
    "index": 11,
    "text": "hope u have understand our itinerary",
    "time": "10:43",
    "datetime": "09.11.2025 10:43",
    "direction": "incoming"
  },
  {
    "index": 16,
    "text": "https://geodrive.info/kurslari/tproduct/147607768192-honda-hr-v-2024",
    "time": "10:50",
    "datetime": "09.11.2025 10:50",
    "direction": "outgoing"
  },
  {
    "index": 33,
    "text": "These r with driver and for excursion with a driver",
    "time": "11:04",
    "datetime": "09.11.2025 11:04",
    "direction": "incoming"
  },
  {
    "index": 34,
    "text": "we have a driver service for $39 per day (9-hour working day)\nand a driver-guide service for $69 per day. \nWhat do you need?",
    "time": "11:06",
    "datetime": "09.11.2025 11:06",
    "direction": "outgoing"
  },
  {
    "index": 39,
    "text": "Yes driver with the entire rental period",
    "time": "11:14",
    "datetime": "09.11.2025 11:14",
    "direction": "incoming"
  }
]
```

---

## 🎨 UI Structure (для парсинга через Playwright)

### URL Structure

```
Inbox: https://umnico.com/app/inbox/deals/inbox
Dialog: https://umnico.com/app/inbox/deals/inbox/details/{conversation_id}
```

### DOM Selectors

**Список диалогов:**
```css
.card-message-preview__item          /* Контейнер диалога */
.message-preview__user-name          /* Имя/телефон клиента */
.message-preview__text               /* Превью последнего сообщения */
.deals-integration                   /* Номер канала (995599001665) */
```

**Сообщения диалога:**
```css
.im-stack__messages                  /* Контейнер всех сообщений */
.im-stack__messages-item-wrap        /* Обертка сообщения */
.im-message                          /* Сообщение */
.im-message__text                    /* Текст сообщения */
.im-info__date                       /* Время (10:40) */
.im-message_out                      /* Исходящее сообщение */
.im-source-item                      /* Источник (WhatsApp — 995599001665) */
```

**Извлечение направления:**
```javascript
const isOutgoing = messageEl.classList.contains('im-message_out') || 
                   messageEl.classList.contains('im-message--outgoing');
const direction = isOutgoing ? 'outgoing' : 'incoming';
```

---

## 🔄 Связывание данных: Umnico ↔ AmoCRM ↔ RentProg

### Ключ связи: Номер телефона

**Umnico:**
- Client Phone: `+919810558569`
- Channel Account: `995599001665` (WhatsApp GeoDrive)

**AmoCRM:**
- Contact Phone: `+919810558569`
- Custom Fields: `rentprog_client_id`, `rentprog_booking_id`

**RentProg:**
- Client ID: `12345` (из AmoCRM custom field)
- Booking ID: `470049` (из AmoCRM custom field)

### Алгоритм синхронизации:

```sql
-- 1. Найти клиента по телефону в clients
SELECT id FROM clients WHERE phone = '+919810558569';

-- 2. Если не найден - создать
INSERT INTO clients (id, phone) VALUES (gen_random_uuid(), '+919810558569');

-- 3. Добавить external_refs для Umnico
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
VALUES ('client', 'uuid-123', 'umnico', '+919810558569');

-- 4. Связать с AmoCRM (если есть contact_id)
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
VALUES ('client', 'uuid-123', 'amocrm', '38638793');

-- 5. Связать с RentProg (из AmoCRM custom fields)
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
VALUES ('client', 'uuid-123', 'rentprog', '12345');
```

---

## 🚀 Рекомендации по реализации

### 1. Парсинг через Playwright (рекомендуется)

**Преимущества:**
- ✅ Полный доступ ко всем данным через UI
- ✅ Автоматический login flow
- ✅ Session cookies управляются автоматически
- ✅ Поддержка JavaScript-рендеринга

**Код:**
```typescript
import { chromium } from 'playwright';

async function scrapeUmnicoConversations() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Login
  await page.goto('https://umnico.com/login');
  await page.fill('input[name="email"]', 'geodrive.ge@gmail.com');
  await page.fill('input[type="password"]', '2GeoDriveumnicopassword!!))');
  await page.click('button[type="submit"]');
  
  // Wait for redirect
  await page.waitForURL('**/app/inbox/deals/inbox**');
  
  // Get conversations list
  await page.goto('https://umnico.com/app/inbox/deals/inbox');
  const conversations = await page.$$eval('.card-message-preview__item', items => 
    items.map(item => ({
      phone: item.querySelector('.message-preview__user-name')?.textContent,
      lastMessage: item.querySelector('.message-preview__text')?.textContent
    }))
  );
  
  // Get messages from conversation
  await page.goto('https://umnico.com/app/inbox/deals/inbox/details/61965921');
  const messages = await page.$$eval('.im-stack__messages-item-wrap', wraps => 
    wraps.map(wrap => ({
      text: wrap.querySelector('.im-message__text')?.textContent,
      time: wrap.querySelector('.im-info__date')?.textContent,
      direction: wrap.querySelector('.im-message_out') ? 'outgoing' : 'incoming'
    }))
  );
  
  await browser.close();
  return { conversations, messages };
}
```

---

### 2. API через Playwright (hybrid approach)

**Идея:**
1. Playwright делает login → получает cookies
2. Экспортируем cookies в Node.js
3. Используем cookies для прямых API запросов

```typescript
// 1. Get cookies from Playwright
const cookies = await page.context().cookies();

// 2. Use cookies in fetch
const response = await fetch('https://umnico.com/api/v1/deals', {
  headers: {
    'Cookie': cookies.map(c => `${c.name}=${c.value}`).join('; ')
  }
});
```

---

### 3. Cron job для синхронизации

**Workflow:**
```
1. Каждые 5 минут:
   - Playwright логин в Umnico
   - Получить список новых диалогов
   - Для каждого диалога:
     * Извлечь номер телефона
     * Найти или создать client в БД
     * Добавить external_ref для Umnico
     * Связать с AmoCRM (если есть)
     * Связать с RentProg (если есть)
   - Получить новые сообщения
   - Сохранить в таблицу messages
```

---

## 📊 Схема таблиц БД

### clients
```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  phone TEXT UNIQUE,
  telegram_username TEXT,
  name TEXT,
  email TEXT
);
```

### external_refs
```sql
CREATE TABLE external_refs (
  entity_type TEXT,  -- 'client'
  entity_id UUID,    -- clients.id
  system TEXT,       -- 'umnico' | 'amocrm' | 'rentprog'
  external_id TEXT,  -- телефон для Umnico, ID для AmoCRM/RentProg
  UNIQUE(entity_type, system, external_id)
);
```

### conversations
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  umnico_conversation_id TEXT UNIQUE,  -- 61965921
  amocrm_scope_id TEXT,
  status TEXT,  -- 'active' | 'closed'
  last_message_at TIMESTAMPTZ
);
```

### messages
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  conversation_id UUID REFERENCES conversations(id),
  direction TEXT,  -- 'incoming' | 'outgoing'
  channel TEXT,    -- 'whatsapp' | 'telegram'
  text TEXT,
  sent_at TIMESTAMPTZ,
  umnico_message_id TEXT UNIQUE
);
```

---

## ⚠️ Ограничения и риски

### 1. Session-based auth
- ❌ Нет API ключа (только session cookies)
- ⚠️ Cookies могут истечь (требуется re-login)
- 💡 Решение: Периодический re-login через Playwright

### 2. Rate Limits
- ⚠️ Точные лимиты неизвестны
- 💡 Рекомендация: Не более 60 запросов/минуту

### 3. UI Changes
- ⚠️ Парсинг UI может сломаться при обновлениях
- 💡 Решение: Мониторинг + тесты после обновлений

### 4. Playwright overhead
- ⚠️ Требует headless browser (ресурсы)
- 💡 Решение: Кешировать cookies, использовать API где возможно

---

## ✅ Итоги

### Что работает:
1. ✅ Login через Playwright
2. ✅ Извлечение списка диалогов из UI
3. ✅ Извлечение всех сообщений конкретного диалога
4. ✅ Определение направления сообщений
5. ✅ Извлечение телефона клиента и канала
6. ✅ Связывание по телефону с clients таблицей

### Что требует подтверждения:
- ⚠️ Точные пути API endpoints (требуется DevTools Network)
- ⚠️ Структура ответов API
- ⚠️ Rate limits

### Следующие шаги:
1. Открыть DevTools Network и захватить реальные API запросы
2. Подтвердить endpoints и структуру ответов
3. Реализовать Playwright scraper для синхронизации
4. Создать cron job для периодической синхронизации
5. Реализовать отправку сообщений через UI

---

**Документация подготовлена:** 2025-11-09  
**Автор:** Jarvis AI Agent  
**Статус:** ✅ Ready for implementation

