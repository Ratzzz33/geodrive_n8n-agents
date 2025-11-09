# 💰 Система синхронизации цен автомобилей

**Дата:** 2025-01-17  
**Статус:** ✅ Готово к деплою  
**Версия:** 1.0.0

---

## 📋 Обзор

Автоматическая синхронизация цен на аренду автомобилей из RentProg API в нашу БД.

### Проблема

**Цены НЕ приходят через вебхуки!** RentProg не отправляет события об изменении цен через webhooks.

### Решение

**Регулярная синхронизация через API:**
- API endpoint `/sync-prices/:branch` для ручного запуска
- n8n workflow для автоматической синхронизации (ежедневно в 3:00)
- Таблица `car_prices` для хранения цен по сезонам
- SQL views и функции для удобного доступа

---

## 🏗️ Архитектура

```
┌──────────────────────────────────────┐
│ RentProg API /cars (с ценами)       │
└───────────────┬──────────────────────┘
                │
                ▼
┌──────────────────────────────────────┐
│ API: GET /sync-prices/:branch        │
│ Module: sync_prices_module.mjs       │
└───────────────┬──────────────────────┘
                │
    ┌───────────┴───────────┐
    ▼                       ▼
┌─────────────┐    ┌────────────────┐
│ Find Cars   │    │ Extract Prices │
│ via         │    │ by Seasons     │
│ external_   │    │                │
│ refs        │    │                │
└──────┬──────┘    └────────┬───────┘
       │                    │
       └──────────┬─────────┘
                  ▼
        ┌──────────────────┐
        │ Upsert to        │
        │ car_prices       │
        └──────────────────┘
```

---

## 📊 База данных

### Таблица `car_prices`

```sql
CREATE TABLE car_prices (
  id UUID PRIMARY KEY,
  car_id UUID REFERENCES cars(id),
  
  -- RentProg IDs
  rentprog_price_id TEXT,
  season_id INTEGER,
  
  -- Сезон
  season_name TEXT,
  season_start_date DATE,
  season_end_date DATE,
  
  -- Цены (JSONB)
  price_values JSONB NOT NULL,
  
  -- Метаданные
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE (car_id, season_id)
);
```

### Структура `price_values`

```json
{
  "periods": ["1-3 дня", "4-7 дней", "8-15 дней", "16-30 дней", "31+ дней"],
  "values": [100, 90, 80, 70, 60],
  "items": [
    {
      "period": "1-3 дня",
      "price_per_day": 100,
      "price_gel": 100,
      "price_usd": 37,
      "currency": "GEL"
    },
    ...
  ],
  "currency": "GEL",
  "exchange_rate": 2.7,
  "season": {
    "start_date": "2025-01-01",
    "end_date": "2025-03-31",
    "name": "Зима"
  }
}
```

### View `current_car_prices`

Текущие действующие цены (активные сезоны):

```sql
SELECT * FROM current_car_prices
WHERE plate = 'AB123CD';
```

**Поля:**
- `car_id`, `plate`, `model`
- `season_name`, `season_start_date`, `season_end_date`
- `price_values` (JSONB)
- `min_price_per_day`, `max_price_per_day`
- `currency`, `updated_at`

### Функция `get_car_price_for_days()`

Получить цену за день для указанного количества дней аренды:

```sql
-- Цена аренды на 5 дней
SELECT get_car_price_for_days('car-uuid', 5);

-- Цена аренды на 10 дней на конкретную дату
SELECT get_car_price_for_days('car-uuid', 10, '2025-07-15'::DATE);
```

**Логика периодов:**
- 1-3 дня → период 0
- 4-7 дней → период 1
- 8-15 дней → период 2
- 16-30 дней → период 3
- 31+ дней → период 4

---

## 🔌 API Endpoint

### `GET /sync-prices/:branch`

Синхронизация цен для филиала.

**URL:** `http://46.224.17.15:3000/sync-prices/:branch`

**Параметры:**
- `:branch` - код филиала: `tbilisi`, `batumi`, `kutaisi`, `service-center`

**Response:**

```json
{
  "ok": true,
  "branch": "tbilisi",
  "inserted": 45,
  "updated": 120,
  "skipped": 5,
  "errors": 0
}
```

**Примеры:**

```bash
# Синхронизация для Тбилиси
curl http://46.224.17.15:3000/sync-prices/tbilisi

# Синхронизация для всех филиалов
for branch in tbilisi batumi kutaisi service-center; do
  curl http://46.224.17.15:3000/sync-prices/$branch
done
```

---

## 🔄 Workflow n8n

**Файл:** `n8n-workflows/daily-price-sync.json`  
**Имя:** "Daily Price Sync - RentProg"

### Триггер

**Every Day at 3 AM** - ежедневная синхронизация в 3:00

### Узлы

```
Every Day at 3 AM
  ↓
Set Branches (4 филиала)
  ↓
Split Branches (iteration)
  ↓
Trigger Price Sync (GET /sync-prices/:branch)
  ↓
Check Success → OK
              → ERROR → Send Telegram Alert
  ↓
Format Summary
  ↓
Send Daily Summary (Telegram)
```

### Telegram Alerts

**Канал:** `$env.TELEGRAM_ALERT_CHAT_ID`

**Типы уведомлений:**
1. **Ошибки синхронизации** - при `ok: false`
2. **Ежедневная сводка** - статистика по всем филиалам

---

## 📦 Модуль синхронизации

**Файл:** `setup/sync_prices_module.mjs`

### Функция `syncPricesForBranch(branch)`

**Алгоритм:**

1. **Получить токен RentProg**
   ```javascript
   const token = await getRequestToken(branch);
   ```

2. **Загрузить все машины филиала**
   ```javascript
   const rentprogCars = await fetchCars(branch, token);
   ```

3. **Для каждой машины:**
   - Найти в нашей БД через `external_refs` (по `rentprog_id`)
   - Fallback: поиск по `plate` или `code`
   - Извлечь цены по сезонам из RentProg API
   - Upsert в `car_prices` (ON CONFLICT car_id + season_id)

4. **Вернуть статистику:**
   ```javascript
   {
     ok: true,
     branch: 'tbilisi',
     inserted: 45,  // новые records
     updated: 120,  // обновлённые
     skipped: 5,    // машины не найдены
     errors: 0      // ошибки обработки
   }
   ```

### Особенности

- **Автоматическая конвертация валют:** GEL → USD (курс 2.7)
- **Пропуск нулевых цен:** если все `values = 0` → skip
- **Поиск через external_refs:** основной способ связи машин
- **Fallback поиск:** по госномеру/коду если не найдено в external_refs
- **Graceful errors:** ошибка одной машины не ломает всю синхронизацию

---

## 🚀 Деплой

### Шаг 1: Применить миграцию

```bash
# Подключиться к БД
psql "postgresql://neondb_owner:npg_...@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Выполнить миграцию
\i setup/migrations/012_create_car_prices_table.sql

# Проверить
SELECT COUNT(*) FROM car_prices;
SELECT * FROM current_car_prices LIMIT 5;
```

**Или через Node.js:**
```bash
node -e "
import('postgres').then(m => {
  const sql = m.default(process.env.DATABASE_URL);
  import('fs').then(fs => {
    const migration = fs.readFileSync('setup/migrations/012_create_car_prices_table.sql', 'utf-8');
    sql.unsafe(migration).then(() => {
      console.log('✅ Migration applied');
      sql.end();
    });
  });
});
"
```

---

### Шаг 2: Деплой кода

```bash
# Сборка TypeScript
npm run build

# Деплой на сервер
python deploy_fixes_now.py

# Проверка API
curl http://46.224.17.15:3000/health
```

---

### Шаг 3: Импорт n8n workflow

**Через UI:**
1. Открыть https://n8n.rentflow.rentals
2. Import from file → `n8n-workflows/daily-price-sync.json`
3. Активировать ✅

**Через API:**
```powershell
$N8N_API_KEY = "your_key"
$workflow = Get-Content n8n-workflows/daily-price-sync.json

Invoke-RestMethod `
  -Uri "https://n8n.rentflow.rentals/api/v1/workflows" `
  -Method POST `
  -Headers @{"X-N8N-API-KEY"=$N8N_API_KEY} `
  -Body $workflow
```

---

### Шаг 4: Первая синхронизация

```bash
# Синхронизировать все филиалы вручную
curl http://46.224.17.15:3000/sync-prices/tbilisi
curl http://46.224.17.15:3000/sync-prices/batumi
curl http://46.224.17.15:3000/sync-prices/kutaisi
curl http://46.224.17.15:3000/sync-prices/service-center
```

**Проверка:**
```sql
-- Сколько цен загружено
SELECT 
  b.code as branch,
  COUNT(DISTINCT cp.car_id) as cars_with_prices,
  COUNT(*) as total_price_records
FROM car_prices cp
INNER JOIN cars c ON c.id = cp.car_id
INNER JOIN branches b ON b.id = c.branch_id
WHERE cp.active = TRUE
GROUP BY b.code;

-- Примеры цен
SELECT * FROM current_car_prices LIMIT 10;
```

---

## 💡 Использование

### Получить текущие цены автомобиля

```sql
-- Все цены
SELECT * FROM car_prices 
WHERE car_id = 'car-uuid' 
ORDER BY season_start_date;

-- Текущий сезон
SELECT * FROM current_car_prices 
WHERE car_id = 'car-uuid';
```

### Рассчитать стоимость аренды

```sql
-- Цена за день для 5-дневной аренды
SELECT 
  plate,
  model,
  get_car_price_for_days(id, 5) as price_per_day,
  get_car_price_for_days(id, 5) * 5 as total_5_days
FROM cars
WHERE plate = 'AB123CD';
```

### Найти самые дешёвые автомобили

```sql
SELECT 
  plate,
  model,
  min_price_per_day,
  max_price_per_day,
  currency
FROM current_car_prices
ORDER BY min_price_per_day ASC
LIMIT 10;
```

### Цены по периодам

```sql
SELECT 
  plate,
  model,
  jsonb_array_elements(price_values->'items') as price_item
FROM current_car_prices
WHERE plate = 'AB123CD';
```

**Результат:**
```json
{
  "period": "1-3 дня",
  "price_per_day": 100,
  "price_gel": 100,
  "price_usd": 37,
  "currency": "GEL"
}
```

---

## 📈 Мониторинг

### SQL запросы

#### Статистика синхронизации

```sql
-- Цены по филиалам
SELECT 
  b.code as branch,
  COUNT(DISTINCT cp.car_id) as cars_with_prices,
  COUNT(*) as total_price_records,
  MAX(cp.updated_at) as last_sync
FROM car_prices cp
INNER JOIN cars c ON c.id = cp.car_id
INNER JOIN branches b ON b.id = c.branch_id
WHERE cp.active = TRUE
GROUP BY b.code;
```

#### Автомобили без цен

```sql
-- Машины, у которых нет цен
SELECT 
  b.code as branch,
  c.plate,
  c.model,
  er.external_id as rentprog_id
FROM cars c
INNER JOIN branches b ON b.id = c.branch_id
LEFT JOIN external_refs er ON (
  er.entity_id = c.id 
  AND er.system = 'rentprog' 
  AND er.entity_type = 'car'
)
LEFT JOIN car_prices cp ON cp.car_id = c.id
WHERE cp.id IS NULL
ORDER BY b.code, c.plate;
```

#### Последние обновления

```sql
-- Топ недавно обновлённых цен
SELECT 
  c.plate,
  c.model,
  cp.season_name,
  cp.updated_at
FROM car_prices cp
INNER JOIN cars c ON c.id = cp.car_id
WHERE cp.active = TRUE
ORDER BY cp.updated_at DESC
LIMIT 20;
```

### Telegram уведомления

Настроены в workflow автоматически:

1. **Ошибки синхронизации**
   ```
   ⚠️ Price Sync Error
   
   Branch: tbilisi
   Error: Failed to fetch cars: 500
   ```

2. **Ежедневная сводка** (3:15 утра)
   ```
   💰 Daily Price Sync Summary
   
   ✅ Tbilisi: +5 ~120 -2
   ✅ Batumi: +3 ~85 -1
   ✅ Kutaisi: +2 ~45 -0
   ✅ Service Center: +0 ~10 -0
   
   Total: +10 new, ~260 updated
   ```

---

## 🔧 Troubleshooting

### Проблема: Цены не синхронизируются

**Проверка:**
```bash
# Проверить API
curl http://46.224.17.15:3000/sync-prices/tbilisi

# Проверить логи
docker logs jarvis-api | grep "Price Sync"
```

**Решение:**
1. Проверить токены RentProg в `setup/sync_prices_module.mjs`
2. Проверить доступность RentProg API
3. Проверить external_refs (машины должны быть в БД)

---

### Проблема: Машины не найдены (skipped высокий)

**Диагностика:**
```sql
-- Проверить external_refs
SELECT COUNT(*) 
FROM external_refs 
WHERE system = 'rentprog' 
  AND entity_type = 'car';

-- Машины без external_refs
SELECT plate, model 
FROM cars 
WHERE id NOT IN (
  SELECT entity_id FROM external_refs 
  WHERE system = 'rentprog' AND entity_type = 'car'
)
LIMIT 10;
```

**Решение:**
1. Запустить snapshot sync для cars
2. Проверить поля `plate` и `data->>'code'` в таблице `cars`

---

### Проблема: Дубликаты цен

**Диагностика:**
```sql
-- Найти дубликаты
SELECT car_id, season_id, COUNT(*) 
FROM car_prices 
GROUP BY car_id, season_id 
HAVING COUNT(*) > 1;
```

**Решение:**
```sql
-- Удалить дубликаты, оставить последний
DELETE FROM car_prices 
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY car_id, season_id 
             ORDER BY updated_at DESC
           ) as rn
    FROM car_prices
  ) t
  WHERE t.rn > 1
);
```

---

## ✨ Best Practices

### 1. Регулярная синхронизация

**Частота:** Ежедневно (достаточно, цены меняются редко)

**Время:** 3:00 утра (минимальная нагрузка)

---

### 2. Мониторинг актуальности

```sql
-- Проверка устаревших цен (> 7 дней)
SELECT 
  b.code as branch,
  COUNT(*) as outdated_prices
FROM car_prices cp
INNER JOIN cars c ON c.id = cp.car_id
INNER JOIN branches b ON b.id = c.branch_id
WHERE cp.active = TRUE
  AND cp.updated_at < NOW() - INTERVAL '7 days'
GROUP BY b.code;
```

**Действие:** Запустить ручную синхронизацию если найдены устаревшие.

---

### 3. Очистка старых сезонов

```sql
-- Деактивировать сезоны в прошлом
UPDATE car_prices
SET active = FALSE
WHERE season_end_date < CURRENT_DATE - INTERVAL '30 days'
  AND active = TRUE;
```

**Частота:** Раз в месяц

---

### 4. Кэширование цен

Для быстрого доступа к ценам можно добавить материализованное view:

```sql
CREATE MATERIALIZED VIEW cached_current_prices AS
SELECT * FROM current_car_prices;

-- Обновлять после синхронизации
REFRESH MATERIALIZED VIEW cached_current_prices;
```

---

## 🗺️ Roadmap

### v1.1 (Февраль 2025)
- [ ] Поддержка специальных скидок/акций
- [ ] История изменения цен (temporal tables)
- [ ] Webhook от RentProg при изменении цен (если добавят)

### v1.2 (Март 2025)
- [ ] Автоматическая валютная конвертация через API курсов
- [ ] Цены с учётом страховок и доп. оборудования
- [ ] API для внешних систем (сайт, боты)

### v1.3 (Апрель 2025)
- [ ] Аналитика ценообразования
- [ ] Рекомендации по ценам (ML)
- [ ] Интеграция с бухгалтерией

---

## 📚 Заключение

**Система синхронизации цен** полностью автоматизирует загрузку и обновление цен из RentProg с:

✅ **Ежедневной автосинхронизацией** - цены всегда актуальны  
✅ **Структурированным хранением** - цены по сезонам и периодам  
✅ **Удобным доступом** - SQL views и функции  
✅ **Мониторингом** - Telegram алерты + статистика  
✅ **API endpoint** - для ручного запуска  

**Статус:** ✅ Готово к продакшену

---

**Контакты:**  
- API: `http://46.224.17.15:3000/sync-prices/:branch`
- n8n: `https://n8n.rentflow.rentals`
- Telegram: `@n8n_alert_geodrive_bot`

**Дата релиза:** 2025-01-17  
**Версия:** 1.0.0

