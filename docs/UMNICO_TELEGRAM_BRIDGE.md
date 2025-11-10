# Umnico Telegram Bridge - Документация

**Дата:** 2025-11-09  
**Статус:** ✅ Реализовано  
**Версия:** 1.0

---

## Описание

Система автоматического создания тем в Telegram для каждого диалога с клиентом из Umnico, с real-time синхронизацией сообщений и управлением сессиями ожидания ответа клиента.

## Архитектура

```
┌─────────────────────────────────────────────────────────┐
│ Umnico Playwright Service (существующий)                 │
│ - Polling активных чатов каждые 5-10 сек                │
│ - Отправка сообщений через UI                           │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ UmnicoRealtimeSync (новый)                              │
│ - Polling активных диалогов каждые 5 секунд             │
│ - Получение новых сообщений через Playwright Service    │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ UmnicoTelegramBridge (новый)                            │
│ - Создание тем в Telegram форуме                         │
│ - Управление сессиями (1 час таймер)                    │
│ - Отправка сообщений в темы                             │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Telegram Bot (расширение)                                │
│ - Обработка кнопок (закрыть/продлить)                   │
│ - Обработка сообщений в темах → отправка в Umnico       │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ База данных                                             │
│ - conversations (связь с Telegram темами)               │
│ - messages (история переписки)                          │
└─────────────────────────────────────────────────────────┘
```

## Компоненты

### 1. UmnicoTelegramBridge

**Файл:** `src/services/umnicoTelegramBridge.ts`

**Основные методы:**
- `handleNewMessage()` - обработка нового сообщения из Umnico
- `getOrCreateTopic()` - получение или создание темы в Telegram
- `createNewTopic()` - создание новой темы с закрепленным сообщением
- `sendMessageToTopic()` - отправка сообщения в тему
- `closeSession()` - закрытие сессии (архивация темы)
- `extendSession()` - продление сессии на 1 час

**Особенности:**
- Автоматическое определение ответственного сотрудника через активную бронь
- Форматирование названия темы: "Имя Клиента | Автомобиль | Даты"
- Закрепленное сообщение с информацией о клиенте и ссылкой на веб-интерфейс

### 2. UmnicoRealtimeSync

**Файл:** `src/services/umnicoRealtimeSync.ts`

**Функции:**
- Polling активных чатов каждые 5 секунд (настраивается через `UMNICO_POLLING_INTERVAL`)
- Получение новых сообщений через Playwright Service API
- Обработка через UmnicoTelegramBridge
- Обновление `last_message_at` в БД

**Логика:**
- Получает только активные чаты (`session_expires_at > NOW()`)
- Для каждого чата запрашивает новые сообщения с фильтром по времени
- Обрабатывает до 20 чатов за цикл

### 3. Playwright Service (расширен)

**Файл:** `services/playwright-umnico.ts`

**Новые методы:**
- `sendMessage(conversationId, text)` - отправка сообщения через UI
- `getNewMessages(conversationId, since?)` - получение новых сообщений с фильтром

**Новые endpoints:**
- `POST /api/conversations/:id/send` - отправка сообщения
- `GET /api/conversations/:id/messages?since=ISO_DATE` - получение новых сообщений

### 4. Telegram Bot Handlers

**Файлы:**
- `src/bot/handlers/umnicoCallbacks.ts` - обработка кнопок
- `src/bot/handlers/umnicoMessages.ts` - обработка сообщений в темах

**Обработчики:**
- `close_dialog_{conversationId}` - закрытие диалога
- `extend_dialog_{conversationId}` - продление сессии
- Сообщения в темах → отправка клиенту через Umnico

### 5. API Endpoints

**Файлы:**
- `src/api/routes/umnico-send.ts` - `POST /api/umnico/send`
- `src/api/routes/umnico-conversation.ts` - `GET /api/umnico/conversations/:id`

**Использование:**
- Отправка сообщений через Jarvis API
- Получение истории диалога для веб-интерфейса

### 6. Веб-интерфейс

**Файл:** `web/conversations/index.html`

**Функции:**
- Просмотр истории переписки
- Информация о клиенте и брони
- Пагинация для длинных диалогов

**Доступ:**
- Локально: `http://localhost:3000/conversations/{conversationId}`
- Продакшен: `https://conversations.rentflow.rentals/conversations/{conversationId}`

## Настройка

### 1. Применить миграцию БД

```bash
# Через Neon Console или psql
psql $DATABASE_URL -f sql/umnico_telegram_integration.sql
```

### 2. Настроить переменные окружения

Добавить в `.env`:

```env
# ID Telegram чата (группы/форума) для Umnico диалогов
UMNICO_FORUM_CHAT_ID=-5015844768

# Интервал polling активных чатов в секундах (по умолчанию 5)
UMNICO_POLLING_INTERVAL=5

# URL веб-приложения для истории переписки
WEB_APP_URL=https://conversations.rentflow.rentals

# URL Playwright Service (если отличается от localhost:3001)
PLAYWRIGHT_UMNICO_URL=http://localhost:3001
```

### 3. Проверить тип Telegram чата

```bash
node setup/check_telegram_chat_type.mjs
```

Если чат не является форумом, следуйте инструкциям в выводе скрипта для конвертации.

### 4. Перезапустить сервисы

```bash
# Пересобрать Playwright Service (если изменили код)
cd services
npm run build
docker compose restart playwright-umnico

# Перезапустить Jarvis API
npm run build
# На сервере: docker compose restart jarvis-api
```

## Использование

### Автоматическая работа

После настройки система работает автоматически:

1. **Новое сообщение от клиента в Umnico:**
   - UmnicoRealtimeSync обнаруживает через polling (5 сек)
   - UmnicoTelegramBridge создает тему (если еще нет)
   - Сообщение публикуется в тему
   - Таймер сессии устанавливается на 1 час

2. **Ответ сотрудника в Telegram теме:**
   - Обработчик определяет тему Umnico
   - Сообщение отправляется клиенту через Playwright Service
   - Сохраняется в БД как outgoing message

3. **Истечение сессии (1 час без ответа):**
   - Автоматическое закрытие темы
   - Сообщение о закрытии в тему
   - Статус диалога → 'closed'

### Ручное управление

**Закрыть диалог:**
- Нажать кнопку "❌ Закрыть диалог" в закрепленном сообщении

**Продлить сессию:**
- Нажать кнопку "⏰ Продлить на 1 час" в закрепленном сообщении

**Просмотреть историю:**
- Нажать ссылку "Открыть в веб-интерфейсе" в закрепленном сообщении

## Структура данных

### Таблица conversations (новые поля)

```sql
tg_chat_id BIGINT              -- ID Telegram чата
tg_topic_id INTEGER            -- ID темы в форуме
client_name TEXT               -- Имя клиента для названия темы
car_info TEXT                  -- Информация об авто
booking_dates TEXT             -- Даты бронирования
session_expires_at TIMESTAMPTZ -- Время истечения сессии
assigned_employee_id UUID      -- Ответственный сотрудник
```

### Формат названия темы

```
Имя Клиента | Автомобиль | 12.11-15.11
```

Максимум 64 символа (лимит Telegram).

## API Endpoints

### POST /api/umnico/send

Отправить сообщение клиенту через Umnico.

**Request:**
```json
{
  "conversationId": "61965921",
  "text": "Hello! How can I help you?"
}
```

**Response:**
```json
{
  "ok": true,
  "conversationId": "61965921",
  "message": "Message sent successfully"
}
```

### GET /api/umnico/conversations/:id

Получить историю диалога.

**Query params:**
- `limit` - количество сообщений (default: 50, max: 200)
- `offset` - смещение для пагинации (default: 0)

**Response:**
```json
{
  "ok": true,
  "conversation": {
    "id": "uuid",
    "umnicoConversationId": "61965921",
    "client": {
      "name": "Иван Иванов",
      "phone": "+995599001665"
    },
    "carInfo": "Honda HR-V",
    "bookingDates": "12.11-15.11"
  },
  "messages": [...],
  "pagination": {
    "total": 42,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

## Производительность

- **Интервал polling:** 5 секунд (настраивается)
- **Время обработки чата:** ~2-3 секунды
- **Максимум чатов за цикл:** 20
- **Типичное время цикла:** 10-15 секунд для 5 активных чатов

## Troubleshooting

### Тема не создается

**Проверьте:**
1. Чат является форумом: `node setup/check_telegram_chat_type.mjs`
2. Бот имеет права администратора в чате
3. `UMNICO_FORUM_CHAT_ID` установлен правильно
4. Логи Jarvis API на наличие ошибок

### Сообщения не синхронизируются

**Проверьте:**
1. Playwright Service запущен: `docker ps | grep playwright-umnico`
2. UmnicoRealtimeSync запущен (логи Jarvis API)
3. Есть активные чаты в БД: `SELECT * FROM conversations WHERE session_expires_at > NOW()`

### Сообщения не отправляются клиенту

**Проверьте:**
1. Playwright Service доступен: `curl http://localhost:3001/health`
2. Сессия Umnico не истекла: `POST /api/relogin` в Playwright Service
3. Логи Playwright Service на наличие ошибок

### Веб-интерфейс не открывается

**Проверьте:**
1. Nginx настроен для проксирования на `http://localhost:3000`
2. Jarvis API запущен и слушает порт 3000
3. SSL сертификат настроен (для продакшена)

## Мониторинг

### Логи

**Jarvis API:**
```bash
docker logs jarvis-api --tail 100 -f
```

**Playwright Service:**
```bash
docker logs playwright-umnico --tail 100 -f
```

### SQL запросы для мониторинга

**Активные сессии:**
```sql
SELECT 
  umnico_conversation_id,
  client_name,
  session_expires_at,
  EXTRACT(EPOCH FROM (session_expires_at - NOW())) / 60 as minutes_remaining
FROM conversations
WHERE session_expires_at > NOW()
AND status = 'active'
ORDER BY session_expires_at ASC;
```

**Статистика тем:**
```sql
SELECT 
  COUNT(*) FILTER (WHERE tg_topic_id IS NOT NULL) as topics_created,
  COUNT(*) FILTER (WHERE session_expires_at > NOW()) as active_sessions,
  COUNT(*) FILTER (WHERE status = 'closed') as closed_sessions
FROM conversations
WHERE umnico_conversation_id IS NOT NULL;
```

## Будущие улучшения

1. **Персональные чаты сотрудников:**
   - Создание чата "Umnico - {Имя}" для каждого сотрудника
   - Автоматическое назначение тем по `assigned_employee_id`

2. **Подключение участников:**
   - Механизм добавления сотрудников в тему
   - Создание аналогичной темы в группе сотрудника

3. **Улучшенная обработка ошибок:**
   - Retry логика для Playwright Service
   - Fallback на polling при недоступности сервиса

4. **Аналитика:**
   - Метрики времени ответа
   - Статистика закрытых сессий
   - Отчеты по активности диалогов

---

**Документация подготовлена:** 2025-11-09  
**Автор:** Jarvis AI Agent  
**Статус:** ✅ Готово к использованию

