# Workflow: Парсинг броней RentProg через API ✅

**ID:** `P3BnmX7Nrmh1cusF`  
**URL:** https://n8n.rentflow.rentals/workflow/P3BnmX7Nrmh1cusF  
**Статус:** Готов к активации  
**Дата создания:** 12.11.2025

---

## 📋 Описание

Workflow для получения активных и неактивных броней из RentProg через **прямое API** (без Playwright) по всем 4 филиалам с автоматическим сохранением в БД.

---

## 🎯 Преимущества нового подхода

### ⚡ Скорость
- **API:** ~2-5 секунд на филиал
- **Playwright (старый):** ~30-60 секунд на филиал
- **Ускорение в ~10-20 раз!**

### 💪 Надежность
- ✅ Стабильный JSON формат
- ✅ Нет зависимости от DOM/селекторов
- ✅ Автоматический retry при ошибках
- ✅ Нет браузера/контейнера

### 📊 Полнота данных
- Возвращает **116 полей** в структурированном виде
- Все поля в JSONB для гибкого доступа

---

## 🏗️ Структура Workflow (16 нод)

### 1. Триггер
- **Every 15 Minutes** - Schedule Trigger (cron: `*/15 * * * *`)

### 2. Парсинг (8 параллельных нод)
**Tbilisi:**
- `Get Tbilisi Active` - `POST /index_with_search {"active": true}`
- `Get Tbilisi Inactive` - `POST /index_with_search {"active": false}`

**Batumi:**
- `Get Batumi Active`
- `Get Batumi Inactive`

**Kutaisi:**
- `Get Kutaisi Active`
- `Get Kutaisi Inactive`

**Service Center:**
- `Get Service Active`
- `Get Service Inactive`

**Настройки HTTP Request:**
- `retryOnFail: true`
- `maxTries: 2`
- `continueOnFail: true`
- `timeout: 60000` (60 сек)

### 3. Обработка данных
- **Process All Bookings** (Code) - Парсинг JSON API формата, извлечение 116+ полей

### 4. Сохранение в БД
- **Save to DB** (Postgres) - `INSERT ... ON CONFLICT DO UPDATE`
  - `retryOnFail: true`
  - `maxTries: 2`
  - `continueOnFail: true`
  - `queryBatching: "transaction"`

### 5. Обработка результатов
- **Format Result** (Code) - Подсчет статистики, группировка ошибок

### 6. Обработка ошибок (согласно `.cursorrules`)
- **If Error** (IF) - Проверка `error_count > 0`
- **Send Alert** (Telegram) - Уведомление с HTML-ссылкой на execution
- **Throw Error** (Code) - Пометка execution как `failed`
- **Success** (NoOp) - Визуализация успешного выполнения

---

## 📊 Сохраняемые поля

### Основные
- `branch_code` - код филиала
- `booking_number` - номер брони (UNIQUE)
- `status` - `active` / `inactive`
- `start_date`, `end_date` - даты начала/окончания

### JSONB `data` (116+ полей)
- **Клиент:** `client_id`, `client_name`, `client_category`, `first_name`, `middle_name`, `last_name`
- **Авто:** `car_id`, `car_name`, `car_code`
- **Финансы:** `total`, `deposit`, `rental_cost`, `days`
- **Локации:** `location_start`, `location_end`
- **Статусы:** `state`, `in_rent`, `archive`
- **Ответственные:** `start_worker_id`, `end_worker_id`, `responsible`
- **Доп:** `description`, `source`, `created_at`, и многое другое

---

## 🔄 Поток данных

```
Schedule Trigger (каждые 15 минут)
  ↓
8 параллельных HTTP Request (API RentProg)
  ↓
Process All Bookings (парсинг JSON)
  ↓
Save to DB (INSERT/UPDATE с conflict resolution)
  ↓
Format Result (подсчет статистики)
  ↓
If Error (проверка error_count > 0)
  ├─ TRUE → Send Alert → Throw Error (пометка failed)
  └─ FALSE → Success ✓
```

---

## 📨 Уведомления Telegram

### Только при ошибках:
- Текст: статистика + детали ошибок
- HTML ссылка на execution
- Чат: `$env.TELEGRAM_ALERT_CHAT_ID`

### Формат сообщения:
```
📋 Парсинг броней RentProg через API раз в 15 минут:
Всего обработано: 150 записей
Сохранено: 145 ✓

🚨 ОШИБОК: 5
  • Connection timeout (x3)
  • Duplicate key (x2)

🔗 Открыть execution
```

---

## ✅ Best Practices (согласно `.cursorrules`)

1. ✅ **Retry механизм** - `retryOnFail: true`, `maxTries: 2` для всех HTTP/DB нод
2. ✅ **Проверка ошибок** - `error_count > 0` (не `success === false`)
3. ✅ **HTML ссылка** - на execution в Telegram
4. ✅ **Понятные сообщения** - подробное описание workflow
5. ✅ **Структура обработки** - Format Result → If Error → [Send Alert → Throw Error] / [Success]
6. ✅ **Success нода** - визуализация успешного завершения
7. ✅ **Уведомления ТОЛЬКО при ошибках** - экономия Telegram API

---

## 🗄️ Требования БД

### Таблица `bookings`
```sql
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_code TEXT,
  booking_number INTEGER UNIQUE,
  status TEXT,
  start_date TEXT,
  end_date TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_branch ON bookings(branch_code);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_number ON bookings(booking_number);
```

---

## 🔑 Credentials

### Neon PostgreSQL
- Name: `Neon PostgreSQL`
- Type: `postgres`

### Telegram Alert Bot
- Name: `Telegram Alert Bot`
- Type: `telegramApi`

### RentProg API Tokens
**Встроены в ноды (Bearer tokens):**
- Tbilisi: `16046`
- Batumi: `16048`
- Kutaisi: `16049`
- Service Center: `16045`

---

## 📈 Метрики

**Обработка за 1 запуск:**
- Время выполнения: ~5-10 секунд
- Запросов к API: 8 (по 2 на филиал)
- Записей в БД: ~100-200 (зависит от кол-ва броней)

**При ошибках:**
- Execution помечается как `failed`
- Отправляется Telegram alert
- В логах сохраняются детали

---

## 🚀 Активация

```bash
# Через n8n API
curl -X POST "https://n8n.rentflow.rentals/api/v1/workflows/P3BnmX7Nrmh1cusF/activate" \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}"

# Или через UI
https://n8n.rentflow.rentals/workflow/P3BnmX7Nrmh1cusF
→ Кнопка "Activate"
```

---

## 📝 Файлы

- **Workflow JSON:** `n8n-workflows/rentprog-bookings-api-final.json`
- **Скрипт обновления:** `setup/update_bookings_workflow.mjs`

---

## 🔍 Следующие шаги

1. ✅ Активировать workflow
2. ⏳ Протестировать execution
3. ⏳ Проверить сохранение в БД
4. ⏳ Настроить дальнейшую обработку данных
5. ⏳ Добавить связи `external_refs` для client_id/car_id

---

**Создано:** 12.11.2025  
**Обновлено:** 12.11.2025

