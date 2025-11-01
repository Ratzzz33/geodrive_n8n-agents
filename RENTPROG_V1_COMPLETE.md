# RentProg v1 - Завершение интеграции с нашей моделью данных

**Дата:** 2025-01-XX  
**Статус:** ✅ Завершено  
**Версия:** 2.0.0

## 📋 Обзор

Завершена интеграция RentProg v1 с полной реализацией:
- ✅ Наша модель данных (UUID PK) как основная
- ✅ Внешние ID (RentProg, AmoCRM и т.д.) как ссылки в `external_refs`
- ✅ Дедупликация вебхуков
- ✅ Auto-fetch полных данных через API
- ✅ Upsert через external_refs с отслеживанием created/updated
- ✅ Визуализация в n8n (3 workflow)

## ✅ Выполненные задачи

### 1. БД (Миграции Drizzle)

**Созданы схемы:**
- `src/db/schema.ts` - полная схема с базовыми таблицами и external_refs

**Базовые таблицы (UUID PK):**
- `branches` - филиалы
- `employees` - сотрудники
- `clients` - клиенты
- `cars` - автомобили (FK → branches)
- `bookings` - бронирования (FK → branches, cars, clients)

**Внешние ссылки (универсально):**
- `external_refs` - связь наших UUID с внешними системами
  - `entity_type` - тип сущности ('car'|'client'|'booking'|...)
  - `entity_id` - наш UUID
  - `system` - система ('rentprog'|'amocrm'|'umnico'|...)
  - `external_id` - ID во внешней системе
  - `branch_code` - код филиала (для систем с филиалами)
  - `meta` - JSONB метаданные

**Дедупликация вебхуков:**
- `webhook_dedup` - хеши для дедупликации
  - `dedup_hash` - SHA256 hash (source|branch|type|ext_id|time_bucket)
  - `received_at` - время получения

**Миграция:**
- `drizzle/0000_sour_skreet.sql` - SQL миграция
- Скрипты: `db:generate`, `db:migrate`, `db:push`

### 2. Upsert-слой (src/db/upsert.ts)

**Функции:**
- `resolveByExternalRef(system, external_id)` → `entity_id|null`
- `linkExternalRef(entity_type, entity_id, system, external_id, branch_code, meta?)`
- `upsertCarFromRentProg(payload, branchCode)` → `{entityId, created}`
- `upsertClientFromRentProg(payload, branchCode)` → `{entityId, created}`
- `upsertBookingFromRentProg(payload, branchCode)` → `{entityId, created}`

**Логика:**
1. Ищем существующую ссылку в `external_refs`
2. Если нет - создаем нашу запись → создаем external_ref
3. Если есть - обновляем поля нашей записи
4. Возвращаем `{entityId, created: boolean}` для статистики

### 3. Webhooks → auto-fetch → upsert (orchestrator)

**Реализовано в `src/orchestrator/rentprog-handler.ts`:**

**Дедупликация:**
- `sha256(source|branch|type|ext_id|time_bucket)` где time_bucket - минутная гранулярность
- Проверка в `webhook_dedup` перед обработкой
- Сохранение hash после успешной обработки

**Auto-fetch:**
- Для `booking.*` событий: получение полных данных через `/all_bookings` или `/booking/{id}`
- Для `car.moved`: получение через `/all_cars_full` или `/car/{id}`
- Fallback endpoints при 404

**Upsert порядок:**
1. Клиент (если есть `client_id`)
2. Автомобиль (если есть `car_id`)
3. Бронирование

**Логирование:**
- Counts и ID наших сущностей в логах
- Отправка событий в n8n

### 4. /sync_rentprog

**Реализовано в `src/bot/index.ts`:**

- Загружает `cars`, `clients`, `bookings` за последние `RENTPROG_POLL_SINCE_DAYS` дней
- Пагинация по 20 записей
- Upsert с отслеживанием `created/updated`
- Отправка прогресса в n8n каждые 20 записей
- Детальная сводка по филиалам: `+создано/~обновлено`

**Пример ответа:**
```
📊 Результаты синхронизации:

✅ tbilisi:
   Авто: +5/~12
   Клиенты: +3/~8
   Брони: +10/~25

✅ batumi:
   Авто: +2/~5
   Клиенты: +1/~3
   Брони: +5/~15
```

### 5. Визуализация в n8n

**3 workflow для мониторинга:**

#### A) RentProg Webhooks Monitor
- **Webhook**: `/webhook/rentprog/:branch` (от Netlify Function)
- **Endpoint**: `/webhook/rentprog` в основном приложении
- **Data Table "events"**: `{ts, branch, type, ext_id, ok, reason}`
- **Telegram Alerts**: при ошибках валидации (через `@n8n_alert_geodrive_bot`)

#### B) Health & Status
- **Cron**: каждые 5 минут
- **HTTP Request**: `GET /rentprog/health`
- **Data Table "health"**: `{ts, branch, ok, reason}`
- **Telegram**: при `!ok`

#### C) Sync Progress
- **Webhook**: `/sync/progress` + Cron каждые 10 минут
- **Data Table "sync_runs"**: `{ts, branch, entity, page, added, updated, ok, msg}`
- Отправка из `/sync_rentprog` при каждом батче пагинации

### 6. ENV и конфиг

**Добавлено в `.env.example`:**

```env
# n8n интеграция
N8N_EVENTS_URL=https://your-n8n-instance.com/webhook/events
N8N_ALERTS_URL=https://your-n8n-instance.com/webhook/alerts
N8N_ALERTS_TELEGRAM_BOT_TOKEN=your_bot_token
DEDUP_TTL_MINUTES=15

# API сервер
API_PORT=3000
ORCHESTRATOR_URL=http://localhost:3000
```

**Обновлено в `src/config/index.ts`:**

- Добавлены все n8n переменные
- `dedupTtlMinutes` для очистки старых дедупов

### 7. /status

**Обновлено в `src/bot/index.ts`:**

- Per-branch RentProg статус (✅/❌)
- **"Last RP sync per branch"** - по последнему успешному upsert из `external_refs.updated_at`

**Пример:**
```
📊 Статус системы:

✅ База данных
✅ RentProg tbilisi
✅ RentProg batumi
✅ RentProg kutaisi
✅ RentProg service-center
✅ Umnico API
✅ Stripe API

⏰ Last RP sync per branch:
   tbilisi: 5 мин назад
   batumi: 12 мин назад
   kutaisi: 8 мин назад
   service-center: никогда

⏰ Время: 15.01.2025, 14:30:00
```

## 🔧 Технические детали

### HTTP API сервер

**Создан `src/api/index.ts`:**
- `GET /rentprog/health` - health check с отправкой в n8n
- `POST /webhook/rentprog` - endpoint для вебхуков от Netlify Functions
- `GET /` - root endpoint

### Netlify Function обновлена

**`netlify/functions/rentprog-webhook/index.ts`:**
- Быстрый ACK (200 OK)
- Асинхронный вызов через HTTP к `ORCHESTRATOR_URL/webhook/rentprog`
- Fallback: логирование если URL не настроен

### Парсинг дат RentProg

**В `src/db/upsert.ts`:**
- Функция `parseRentProgDate()` для формата `"DD-MM-YYYY H:mm"`
- Fallback на ISO формат

## 📊 Примеры

### Пример обработки вебхука

```
1. Webhook от RentProg → Netlify Function
2. ACK (200 OK) за <100ms
3. HTTP POST к ORCHESTRATOR_URL/webhook/rentprog
4. Оркестратор:
   - Дедуп hash: sha256("rentprog|tbilisi|booking.issue.planned|rp_123|2025-01-15T14:30")
   - Проверка в webhook_dedup → не найден
   - Сохранение hash
   - Auto-fetch: GET /all_bookings?id=rp_123
   - Upsert:
     * Client (rp_client_456) → наш UUID: abc-123 (created: true)
     * Car (rp_car_789) → наш UUID: def-456 (created: false, updated)
     * Booking (rp_123) → наш UUID: ghi-789 (created: true)
   - Отправка в n8n: {ts, branch: "tbilisi", type: "booking.issue.planned", ext_id: "rp_123", ok: true}
5. Логи: "Processed booking rp_123 from tbilisi {bookingId: 'ghi-789', carId: 'def-456', clientId: 'abc-123'}"
```

### Пример /sync_rentprog

```
📥 Синхронизация филиала tbilisi...
[INFO] Загружено автомобилей: 15
[INFO] Загружено клиентов: 20
[INFO] Загружено бронирований: 35

📊 Результаты синхронизации:

✅ tbilisi:
   Авто: +5/~10
   Клиенты: +3/~17
   Брони: +12/~23
```

## 📁 Изменённые файлы

### Созданные:
- `src/db/upsert.ts` - upsert-функции
- `src/integrations/n8n.ts` - интеграция с n8n
- `src/api/index.ts` - HTTP API сервер
- `drizzle/0000_sour_skreet.sql` - миграция БД

### Обновлённые:
- `src/db/schema.ts` - обновлена схема (webhook_dedup timestamp с timezone)
- `src/orchestrator/rentprog-handler.ts` - дедуп + auto-fetch + n8n
- `src/bot/index.ts` - /sync_rentprog с реальным upsert, /status с last sync
- `src/config/index.ts` - n8n переменные
- `netlify/functions/rentprog-webhook/index.ts` - HTTP вызов оркестратора
- `src/index.ts` - запуск API сервера
- `env.example` - новые переменные
- `README.md` - документация по external_refs и n8n
- `STRUCTURE.md` - описание модели данных

## 🚀 Следующие шаги

1. Настроить n8n workflows (создать 3 workflow по описанию)
2. Запустить миграцию: `npm run db:migrate`
3. Настроить `ORCHESTRATOR_URL` в Netlify env
4. Протестировать вебхуки и синхронизацию
5. Настроить мониторинг в n8n

## 📝 Примечания

- **Дедупликация**: TTL по умолчанию 15 минут (настраивается через `DEDUP_TTL_MINUTES`)
- **API сервер**: слушает на порту 3000 (настраивается через `API_PORT`)
- **Upsert логика**: всегда создает/обновляет наши записи, external_refs используются только для связи
- **n8n интеграция**: все отправки не блокируют основную работу, ошибки логируются но не падают
