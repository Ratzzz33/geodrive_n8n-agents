# 🚀 Umnico Integration - Quick Start

## ✅ Разведка завершена!

**Дата:** 2025-11-09  
**Статус:** Готово к реализации

---

## 📦 Созданные артефакты

1. **`auth_profile.json`** - Профиль авторизации (credentials, cookies, localStorage)
2. **`endpoints_spec.json`** - Спецификация API endpoints (deals, messages, contacts)
3. **`UMNICO_RECONNAISSANCE_REPORT.md`** - Полный отчет с примерами и рекомендациями

---

## 🎯 Ключевые находки

### ✅ Что работает:
- Все сообщения клиентов хранятся **В UMNICO** (в отличие от AmoCRM!)
- Полный доступ к истории переписки через UI
- Извлечено **42 реальных сообщения** из WhatsApp диалога
- Определена структура DOM для парсинга
- Собраны данные авторизации (session cookies)

### 🔑 Данные для входа:
```
Email: geodrive.ge@gmail.com
Password: 2GeoDriveumnicopassword!!))
URL: https://umnico.com/login
```

### 🌐 Base URL:
```
API: https://umnico.com/api/v1/
UI: https://umnico.com/app/inbox/deals/inbox
```

---

## 🔗 Связывание данных

**Ключ связи:** Номер телефона клиента

### Пример:
```
Umnico:   +919810558569 (WhatsApp)
   ↓
AmoCRM:   Contact ID + Custom Fields (rentprog_client_id, rentprog_booking_id)
   ↓
RentProg: Client ID 12345, Booking ID 470049
   ↓
Jarvis DB: UUID в clients + external_refs для всех систем
```

---

## 📊 Извлеченные сообщения (пример)

**Conversation ID:** 61965921  
**Client:** +919810558569  
**Channel:** WhatsApp (995599001665)

```
[10:40] 👤 Hi
[10:42] 💬 Good afternoon! What kind of car are you interested in?
[10:43] 👤 12 NOV - ARRIVING FROM AIRPORT AND DROP AT HOTEL
[10:43] 👤 hope u have understand our itinerary
[10:50] 💬 https://geodrive.info/kurslari/tproduct/147607768192-honda-hr-v-2024
[11:04] 👤 These r with driver and for excursion with a driver
[11:06] 💬 we have a driver service for $39 per day (9-hour working day)
[11:14] 👤 Yes driver with the entire rental period
```

**Всего:** 42 сообщения в диалоге

---

## 🛠️ Рекомендации по реализации

### 1. Playwright Scraper (рекомендуется)

**Преимущества:**
- ✅ Автоматический login flow
- ✅ Session cookies управляются автоматически
- ✅ Полный доступ к UI и API

**Код:**
```typescript
import { chromium } from 'playwright';

async function scrapeUmnico() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Login
  await page.goto('https://umnico.com/login');
  await page.fill('input[name="email"]', 'geodrive.ge@gmail.com');
  await page.fill('input[type="password"]', '2GeoDriveumnicopassword!!))');
  await page.click('button[type="submit"]');
  
  // Get messages
  await page.goto('https://umnico.com/app/inbox/deals/inbox/details/61965921');
  const messages = await page.$$eval('.im-stack__messages-item-wrap', wraps => 
    wraps.map(wrap => ({
      text: wrap.querySelector('.im-message__text')?.textContent,
      time: wrap.querySelector('.im-info__date')?.textContent,
      direction: wrap.querySelector('.im-message_out') ? 'outgoing' : 'incoming'
    }))
  );
  
  return messages;
}
```

---

### 2. Таблицы БД

```sql
-- Клиенты (единая таблица)
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  phone TEXT UNIQUE,
  telegram_username TEXT,
  name TEXT
);

-- Внешние ссылки
CREATE TABLE external_refs (
  entity_type TEXT,  -- 'client'
  entity_id UUID,    -- clients.id
  system TEXT,       -- 'umnico' | 'amocrm' | 'rentprog'
  external_id TEXT,  -- телефон или ID
  UNIQUE(entity_type, system, external_id)
);

-- Диалоги
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  umnico_conversation_id TEXT UNIQUE,
  amocrm_scope_id TEXT,
  status TEXT
);

-- Сообщения
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  conversation_id UUID REFERENCES conversations(id),
  direction TEXT,
  channel TEXT,
  text TEXT,
  sent_at TIMESTAMPTZ
);
```

---

### 3. Cron Job

```
Каждые 5 минут:
1. Playwright login в Umnico
2. Получить список диалогов
3. Для каждого нового диалога:
   - Извлечь телефон клиента
   - Найти/создать в clients
   - Добавить external_ref для Umnico
   - Связать с AmoCRM (если есть)
   - Связать с RentProg (если есть)
4. Получить новые сообщения
5. Сохранить в messages
```

---

## 🎬 DOM Selectors (для Playwright)

```css
/* Список диалогов */
.card-message-preview__item          /* Контейнер диалога */
.message-preview__user-name          /* Телефон клиента */
.deals-integration                   /* Номер канала */

/* Сообщения */
.im-stack__messages-item-wrap        /* Обертка сообщения */
.im-message__text                    /* Текст */
.im-info__date                       /* Время */
.im-message_out                      /* Исходящее (outgoing) */
.im-source-item                      /* WhatsApp — 995599001665 */
```

---

## ⚠️ Важно

1. **Session-based auth:** Cookies могут истечь → нужен периодический re-login
2. **Rate Limits:** Неизвестны → рекомендуется ≤60 req/min
3. **UI Changes:** Парсинг может сломаться → нужен мониторинг

---

## 📚 Полная документация

Смотрите **`UMNICO_RECONNAISSANCE_REPORT.md`** для:
- Полной спецификации API
- Примеров кода
- Схемы БД
- Рекомендаций по архитектуре

---

## 🔜 Следующие шаги

1. ✅ Разведка завершена
2. ⏭️ Реализовать Playwright scraper
3. ⏭️ Создать миграции БД (conversations, messages)
4. ⏭️ Настроить cron job для синхронизации
5. ⏭️ Реализовать отправку сообщений через UI
6. ⏭️ Интегрировать с Jarvis API

---

**Статус:** ✅ Готово к разработке!

