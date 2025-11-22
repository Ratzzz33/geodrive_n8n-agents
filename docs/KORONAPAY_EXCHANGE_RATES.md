# 💱 KoronaPay Exchange Rates Parser

Система автоматического парсинга курсов валют KoronaPay (Россия → Грузия) для расчета курсов оплаты и возврата.

---

## 📋 Описание

Парсинг курсов валют с сайта [koronapay.com/transfers/](https://koronapay.com/transfers/) для направления **Россия → Грузия** (RUB → GEL).

**Курсы:**
- `koronapay_payment_rate` - Курс оплаты рублями (сколько RUB за 1 GEL)
- `koronapay_return_rate` - Курс возврата из лари в рубли (сколько RUB за 1 GEL при возврате)

---

## 🗄️ База данных

### Миграция

**Файл:** `setup/migrations/0044_add_koronapay_exchange_rates.sql`

**Изменения:**
- Добавлены поля `koronapay_payment_rate` и `koronapay_return_rate` в таблицу `exchange_rates`
- Тип: `DECIMAL(10, 6)`

**Применить миграцию:**
```bash
psql $DATABASE_URL -f setup/migrations/0044_add_koronapay_exchange_rates.sql
```

### Структура данных

```sql
SELECT 
  ts,
  koronapay_payment_rate,
  koronapay_return_rate,
  raw_data
FROM exchange_rates
WHERE branch = 'koronapay'
ORDER BY ts DESC
LIMIT 1;
```

---

## 🔧 Playwright Service

### Endpoint

**URL:** `POST http://localhost:3001/scrape-koronapay-rates`

**Request:**
```json
{}
```

**Response:**
```json
{
  "success": true,
  "paymentRate": 31.88,
  "returnRate": 31.88,
  "parsedAt": "2025-01-20T12:00:00.000Z"
}
```

**Ошибка:**
```json
{
  "success": false,
  "error": "Exchange rate not found",
  "suggestion": "KoronaPay page structure may have changed. Need to update parsing logic."
}
```

### Реализация

**Файл:** `src/services/playwrightService.ts`

**Метод парсинга:**
1. Открывает страницу `https://koronapay.com/transfers/`
2. Ждет загрузки React-контента (3 секунды)
3. Ищет курс в:
   - `window.__NEXT_DATA__` (Next.js данные)
   - Тексте страницы (паттерны "1 GEL = X RUB")
   - Элементах формы

**Примечание:** KoronaPay использует React, поэтому простой HTTP Request не работает. Нужен Playwright для рендеринга динамического контента.

---

## 📊 n8n Workflow

### Файл

`n8n-workflows/koronapay-exchange-rates-parser.json`

### Структура

```
Every 4 Hours (Schedule Trigger)
  ↓
Scrape KoronaPay via Playwright (HTTP Request → localhost:3001)
  ↓
Parse KoronaPay Rate (Code)
  ↓
Check for Errors (IF)
  ├─ TRUE → Log Error (Postgres)
  └─ FALSE → Save to DB (Postgres)
              ↓
           Format Result (Code)
              ↓
           Success (noOp)
```

### Расписание

**Cron:** `0 8,12,16,20 * * *` (4 раза в день: 8:00, 12:00, 16:00, 20:00)

**Часовой пояс:** `Asia/Tbilisi`

### Настройки

- **Execution Order:** `v1`
- **Timezone:** `Asia/Tbilisi`
- **Save failed executions:** `all`
- **Save successful executions:** `all`
- **Timeout:** `3600` секунд (1 час)

### Импорт workflow

```bash
node setup/import_workflow_2025.mjs n8n-workflows/koronapay-exchange-rates-parser.json
```

**Важно:** После импорта нужно:
1. Проверить credentials для Postgres
2. Проверить URL Playwright сервиса (может быть не `localhost:3001`, а другой адрес)
3. Активировать workflow

---

## 🚀 Запуск

### 1. Применить миграцию БД

```bash
psql $DATABASE_URL -f setup/migrations/0044_add_koronapay_exchange_rates.sql
```

### 2. Убедиться, что Playwright сервис запущен

```bash
# Проверить статус
curl http://localhost:3001/health

# Должно вернуть:
# {"status":"ok","service":"playwright-service"}
```

### 3. Импортировать workflow в n8n

```bash
node setup/import_workflow_2025.mjs n8n-workflows/koronapay-exchange-rates-parser.json
```

### 4. Активировать workflow в n8n UI

1. Открыть: https://n8n.rentflow.rentals/workflows
2. Найти: "KoronaPay Exchange Rates Parser"
3. Нажать: "Activate"

---

## 🧪 Тестирование

### Тест Playwright endpoint

```bash
curl -X POST http://localhost:3001/scrape-koronapay-rates \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Ожидаемый ответ:**
```json
{
  "success": true,
  "paymentRate": 31.88,
  "returnRate": 31.88,
  "parsedAt": "2025-01-20T12:00:00.000Z"
}
```

### Тест сохранения в БД

```sql
-- Проверить последний сохраненный курс
SELECT 
  ts,
  koronapay_payment_rate,
  koronapay_return_rate,
  raw_data
FROM exchange_rates
WHERE branch = 'koronapay'
ORDER BY ts DESC
LIMIT 1;
```

### Ручной запуск workflow

В n8n UI:
1. Открыть workflow "KoronaPay Exchange Rates Parser"
2. Нажать "Execute Workflow"
3. Проверить execution в логах

---

## ⚠️ Известные проблемы

### 1. Структура страницы KoronaPay может измениться

**Проблема:** KoronaPay использует React, и структура страницы может меняться.

**Решение:** 
- Обновить логику парсинга в `src/services/playwrightService.ts`
- Добавить больше вариантов поиска курса
- Использовать более надежные селекторы

### 2. Playwright сервис недоступен

**Проблема:** Workflow не может подключиться к Playwright сервису.

**Решение:**
- Проверить, что сервис запущен: `curl http://localhost:3001/health`
- Проверить URL в workflow (может быть не `localhost:3001`)
- Перезапустить Playwright сервис: `pm2 restart playwright-service`

### 3. Курс не найден

**Проблема:** Playwright не может найти курс на странице.

**Решение:**
- Увеличить время ожидания загрузки React
- Обновить логику поиска курса
- Проверить, что страница загружается корректно

---

## 📝 TODO

- [ ] Улучшить логику парсинга курса (более надежные селекторы)
- [ ] Добавить поддержку разных направлений (не только Россия → Грузия)
- [ ] Добавить уведомления в Telegram при ошибках парсинга
- [ ] Добавить мониторинг изменений курса (алерты при резких изменениях)
- [ ] Разделить курсы оплаты и возврата (сейчас они одинаковые)

---

## 🔗 Связанные документы

- [Exchange Rates AI System](./EXCHANGE_RATES_AI_SYSTEM.md) - Система работы с курсами валют
- [Playwright Service READY](./PLAYWRIGHT_SERVICE_READY.md) - Документация Playwright сервиса
- [n8n Workflows Rules](../.cursorrules) - Правила работы с n8n workflows

