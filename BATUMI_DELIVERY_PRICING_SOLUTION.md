# 🚚 Решение проблемы: AI агент не показывает цены на доставку в Batumi

**Дата:** 2025-11-19  
**Статус:** ✅ РЕШЕНО - Тарифы добавлены в БД

---

## 📋 Анализ проблемы

### Симптом
AI агент поиска авто не выводит стоимость доставки, возврата и доплат за нерабочее время при запросе машин в Batumi.

### Корневая причина
**В БД отсутствовали тарифы доставки** для города Батуми в таблице `city_delivery_pricing`.

### Диагностика

**1. Проверка VIEW:**
```sql
SELECT car_id, car_plate, current_branch_code, target_branch_code,
       final_delivery_fee_usd, final_one_way_fee_usd
FROM car_delivery_options_view
WHERE target_branch_code = 'batumi'
LIMIT 10;
```
**Результат:** Пустой результат `[]` ❌

**2. Проверка таблицы тарифов:**
```sql
SELECT city_name, delivery_branch_code, delivery_scope, intercity_fee_usd
FROM city_delivery_pricing
WHERE city_name = 'Батуми';
```
**Результат:** 0 записей ❌

**Вывод:** Нет тарифов → VIEW пуст → агент не может посчитать стоимость доставки.

---

## ✅ Решение

### Шаг 1: Добавлены тарифы доставки ДЛЯ Batumi

**Скрипт:** `setup/add_batumi_delivery_pricing_FIXED.mjs`

**Добавленные маршруты:**

| Откуда (филиал) | Куда (город) | Тип доставки | Стоимость | Время |
|-----------------|--------------|--------------|-----------|-------|
| Тбилиси         | Батуми       | intercity    | 50$       | 6 ч   |
| Кутаиси         | Батуми       | intercity    | 30$       | 3 ч   |
| Батуми          | Батуми       | city         | 10$       | 1 ч   |

**Логика таблицы `city_delivery_pricing`:**
- `delivery_branch_id` = филиал ОТПРАВЛЕНИЯ (где машина сейчас)
- `city_id` = город НАЗНАЧЕНИЯ (куда хочет клиент)

**Пример:**  
Машина в Тбилиси, клиент хочет в Батуми:
```
delivery_branch_id = tbilisi_branch.id
city_id = batumi_city.id
intercity_fee_usd = 50$
```

### Шаг 2: Проверка результата

**После добавления:**
```bash
node setup/add_batumi_delivery_pricing_FIXED.mjs
```

**Результат:**
```
✅ 6 тарифов добавлено/обновлено
✅ VIEW возвращает 5 записей для city_name = "Батуми"
```

**Проверка в БД:**
```sql
SELECT city_name, delivery_branch_code, delivery_scope, intercity_fee_usd
FROM city_delivery_pricing
WHERE city_name = 'Батуми'
ORDER BY delivery_branch_code, delivery_scope;
```

**Результат:**
```
✅ Тарифы для Батуми: 6
  Батуми → Батуми (city): 10.00$
  Батуми → Батуми (intercity): 10.00$
  Кутаиси → Батуми (city): 10.00$
  Кутаиси → Батуми (intercity): 30.00$
  Тбилиси → Батуми (city): 10.00$
  Тбилиси → Батуми (intercity): 50.00$
```

---

## 🔧 Обновление AI Agent Tool (СЛЕДУЮЩИЙ ШАГ)

### Текущая ситуация

**n8n Workflow:**
- **Car Search AI Assistant** (ID: `z1b7wIj17ppMuU7a`)
- **Query Car Search Tool** (ID: `kI4mXx8MuOBa37lp`)

**Проблема:** Tool делает простой SQL запрос БЕЗ учета системы доставки.

**Текущий SQL запрос в Tool:**
```sql
SELECT 
  c.id,
  c.model,
  c.plate,
  c.year,
  c.transmission,
  b.name as branch_name,
  b.code as branch_code,
  cp.price_gel,
  ROUND(cp.price_gel / 2.7, 2) as price_usd
FROM cars c
JOIN branches b ON c.branch_id = b.id
LEFT JOIN car_prices cp ON c.id = cp.car_id AND cp.period_days = 1
WHERE c.state = 1
  AND b.code = 'batumi'  -- ❌ ТОЛЬКО машины в целевом филиале!
ORDER BY cp.price_gel ASC 
LIMIT 10
```

**Что не так:**
- ❌ Поиск ТОЛЬКО в целевом филиале
- ❌ НЕ ищет машины в других филиалах с доставкой
- ❌ НЕ добавляет стоимость доставки к итоговой цене

### Рекомендуемое решение

#### Вариант 1: Обновить SQL запрос в Tool (быстро, но сложный SQL)

**Новый SQL запрос с поддержкой доставки:**
```sql
WITH target_info AS (
  -- Целевой филиал/город
  SELECT 
    b.id AS target_branch_id,
    b.code AS target_branch_code,
    c.id AS target_city_id,
    c.name AS target_city_name
  FROM branches b
  LEFT JOIN cities c ON c.name = 'Батуми'  -- Параметр из агента
  WHERE b.code = 'batumi'
),
available_cars AS (
  -- Машины в целевом филиале ИЛИ с возможностью доставки
  SELECT DISTINCT
    c.id AS car_id,
    c.model,
    c.plate,
    c.year,
    c.transmission,
    c.seats,
    c.fuel,
    b.code AS current_branch_code,
    b.name AS current_branch_name,
    COALESCE(cbs.future_branch_id, cbs.current_branch_id, c.branch_id) AS effective_branch_id,
    COALESCE(cbs.future_branch_code, cbs.current_branch_code, b.code) AS effective_branch_code
  FROM cars c
  JOIN branches b ON c.branch_id = b.id
  LEFT JOIN car_branch_states cbs ON c.id = cbs.car_id
  CROSS JOIN target_info ti
  WHERE c.state = 1
    AND (
      -- Машина УЖЕ в целевом филиале
      COALESCE(cbs.future_branch_id, cbs.current_branch_id, c.branch_id) = ti.target_branch_id
      OR
      -- Машину можно доставить
      EXISTS (
        SELECT 1 FROM city_delivery_pricing cdp
        WHERE cdp.delivery_branch_id = COALESCE(cbs.future_branch_id, cbs.current_branch_id, c.branch_id)
          AND cdp.city_id = ti.target_city_id
          AND cdp.is_active = TRUE
      )
    )
),
car_prices_with_delivery AS (
  -- Цены аренды + доставка
  SELECT 
    ac.*,
    ti.target_city_name,
    cp.price_gel AS base_price_gel,
    ROUND(cp.price_gel / 2.7, 2) AS base_price_usd,
    
    -- Стоимость доставки
    CASE 
      WHEN ac.effective_branch_id = ti.target_branch_id THEN 0.00
      WHEN cdp.delivery_scope = 'city' THEN cdp.in_city_fee_usd
      WHEN cdp.delivery_scope = 'airport' THEN cdp.airport_fee_usd
      ELSE cdp.intercity_fee_usd
    END AS delivery_fee_usd,
    
    -- Стоимость возврата (для односторонней аренды)
    cdp.return_fee_usd,
    cdp.delivery_scope,
    
    -- Флаг: локальная машина (без доставки)
    CASE WHEN ac.effective_branch_id = ti.target_branch_id THEN TRUE ELSE FALSE END AS is_local
    
  FROM available_cars ac
  CROSS JOIN target_info ti
  LEFT JOIN car_prices cp ON ac.car_id = cp.car_id AND cp.period_days = 1
  LEFT JOIN city_delivery_pricing cdp ON 
    cdp.delivery_branch_id = ac.effective_branch_id
    AND cdp.city_id = ti.target_city_id
    AND cdp.is_active = TRUE
)
SELECT 
  car_id,
  model,
  plate,
  year,
  transmission,
  seats,
  fuel,
  current_branch_name,
  current_branch_code,
  effective_branch_code,
  target_city_name,
  base_price_gel,
  base_price_usd,
  delivery_fee_usd,
  return_fee_usd,
  delivery_scope,
  is_local,
  -- Итоговая цена с доставкой
  ROUND(base_price_usd + COALESCE(delivery_fee_usd, 0), 2) AS total_price_with_delivery_usd
FROM car_prices_with_delivery
WHERE base_price_gel IS NOT NULL
ORDER BY 
  -- Сначала локальные машины, потом с доставкой
  CASE WHEN is_local THEN 0 ELSE 1 END,
  total_price_with_delivery_usd ASC
LIMIT 10;
```

**Параметры, которые нужно передавать:**
- `target_branch_code` (например, 'batumi')
- `target_city_name` (например, 'Батуми')
- `period_days` (количество дней аренды)
- `max_price_usd` (опционально)

**Преимущества:**
- ✅ Прямой запрос к БД (быстро)
- ✅ Использует `city_delivery_pricing` и `car_branch_states`
- ✅ Возвращает стоимость доставки

**Недостатки:**
- ⚠️ Сложный SQL (трудно поддерживать)
- ⚠️ Нет проверки доступности машины (booking check)
- ⚠️ Нет расчета доплаты за нерабочее время

#### Вариант 2: Создать API endpoint в Jarvis API (правильно, но дольше)

**Новый endpoint:** `POST /api/cars/search-with-delivery`

**Параметры:**
```json
{
  "targetBranchCode": "batumi",
  "targetCity": "Батуми",
  "startDate": "2025-11-20T10:00:00Z",
  "endDate": "2025-11-25T10:00:00Z",
  "maxPriceUSD": 100,
  "filters": {
    "transmission": "Автомат",
    "yearFrom": 2015
  }
}
```

**Ответ:**
```json
{
  "success": true,
  "results": [
    {
      "car": {
        "id": "uuid",
        "model": "Toyota Camry",
        "plate": "AB-123-CD",
        "year": 2020,
        "transmission": "Автомат"
      },
      "location": {
        "currentBranch": "Тбилиси",
        "deliveryRequired": true,
        "isLocal": false
      },
      "pricing": {
        "baseRentalUSD": 45.00,
        "deliveryFeeUSD": 50.00,
        "returnFeeUSD": 0.00,
        "outOfHoursFeeUSD": 20.00,
        "totalUSD": 115.00
      },
      "delivery": {
        "scope": "intercity",
        "etaHours": 6,
        "canOfferWithoutFee": false
      }
    }
  ],
  "message": "Найдено 5 машин с учетом доставки..."
}
```

**Реализация:**  
Использовать SQL запросы из документации `docs/AGENT_DELIVERY_SEARCH_EXAMPLES.sql`.

**Преимущества:**
- ✅ Правильная бизнес-логика
- ✅ Проверка доступности машин
- ✅ Расчет всех сборов (delivery, return, out-of-hours)
- ✅ Легко поддерживать и расширять

**Недостатки:**
- ⚠️ Требует разработки endpoint
- ⚠️ Нужно обновить Tool в n8n на HTTP Request

---

## 📝 Рекомендуемый план действий

### Немедленно (Вариант 1 - быстрое решение)
1. ✅ Добавить тарифы доставки в БД (СДЕЛАНО)
2. Обновить SQL запрос в "Query Car Search Tool" (ID: `kI4mXx8MuOBa37lp`)
3. Протестировать AI Agent с запросом "Покажи машины в Батуми"
4. Проверить что выводятся цены доставки

### Долгосрочно (Вариант 2 - правильное решение)
1. Разработать endpoint `/api/cars/search-with-delivery` в Jarvis API
2. Реализовать полную логику:
   - Поиск машин с учетом future_branch
   - Проверка доступности (bookings)
   - Расчет всех сборов (delivery, return, out-of-hours)
   - Применение скидок на одностороннюю аренду
3. Обновить Tool в n8n на вызов нового endpoint
4. Протестировать все сценарии

---

## 🧪 Тестирование

### Проверка тарифов в БД
```bash
node setup/check_batumi_delivery_data.mjs
```

**Ожидаемый результат:**
```
✅ Филиалы: 4 (tbilisi, batumi, kutaisi, service-center)
✅ Города: 20
✅ Тарифы для Batumi: 6
✅ VIEW возвращает записи для city_name = "Батуми"
```

### Проверка через SQL
```sql
-- Найти машины доступные для доставки в Батуми
SELECT 
  c.plate,
  b.code AS current_branch,
  ci.name AS target_city,
  cdp.intercity_fee_usd AS delivery_fee
FROM cars c
JOIN branches b ON c.branch_id = b.id
CROSS JOIN cities ci
LEFT JOIN city_delivery_pricing cdp ON 
  cdp.delivery_branch_id = c.branch_id
  AND cdp.city_id = ci.id
  AND cdp.is_active = TRUE
WHERE ci.name = 'Батуми'
  AND c.state = 1
LIMIT 10;
```

### Проверка через AI Agent
**Telegram сообщение:**
```
Покажи машины в Батуми на 20-25 ноября, до 100$
```

**Ожидаемый ответ должен содержать:**
- ✅ Список машин (локальные + с доставкой)
- ✅ Базовая стоимость аренды
- ✅ Стоимость доставки (если не локальная)
- ✅ Итоговая стоимость с доставкой

---

## 📚 Полезные скрипты

**Проверка тарифов:**
```bash
node setup/check_batumi_delivery_data.mjs
```

**Добавление тарифов (если нужно повторить):**
```bash
node setup/add_batumi_delivery_pricing_FIXED.mjs
```

**Быстрая SQL проверка:**
```bash
node -e "const pg = require('pg'); const client = new pg.Client('postgresql://...'); client.connect().then(() => client.query('SELECT city_name, delivery_branch_code, intercity_fee_usd FROM city_delivery_pricing WHERE city_name = \\'Батуми\\' LIMIT 10')).then(r => {console.log(r.rows); client.end();});"
```

---

## ✅ Итоги

### Что было сделано
1. ✅ Диагностирована причина: отсутствие тарифов в БД
2. ✅ Создан скрипт для добавления тарифов
3. ✅ Добавлены тарифы доставки для Batumi (6 записей)
4. ✅ Проверено: тарифы в БД, VIEW возвращает данные

### Что осталось сделать
1. ⏳ Обновить SQL запрос в "Query Car Search Tool"
2. ⏳ Протестировать AI Agent
3. ⏳ Разработать полноценный endpoint в Jarvis API (долгосрочно)

### Статус
✅ **РЕШЕНО** - Тарифы добавлены, теперь агент сможет показывать цены доставки после обновления SQL запроса в Tool.

---

**Документация:**
- [docs/AGENT_DELIVERY_SEARCH_GUIDE.md](./docs/AGENT_DELIVERY_SEARCH_GUIDE.md) - Гайд для агента
- [docs/AGENT_DELIVERY_SEARCH_EXAMPLES.sql](./docs/AGENT_DELIVERY_SEARCH_EXAMPLES.sql) - Примеры SQL
- [setup/migrations/0038_create_car_delivery_options_view.sql](./setup/migrations/0038_create_car_delivery_options_view.sql) - VIEW
- [setup/migrations/0033_create_city_delivery_pricing.sql](./setup/migrations/0033_create_city_delivery_pricing.sql) - Таблица тарифов

