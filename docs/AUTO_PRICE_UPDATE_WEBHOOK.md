# 🔄 Автоматическое обновление цен через вебхуки RentProg

**Дата создания:** 2025-11-09  
**Статус:** 📝 Документация

---

## 📋 Список машин без цен (20 машин)

### 🚗 По филиалам:

#### Тбилиси (9 машин):
1. ❌ BMW 430i Cabrio (IV430AN) - BMW Cabrio 430
2. ❌ Chevrolet Cruze HR (BZ551ZB) - Cruze 551 Hatch
3. ❌ Honda HR-V (RV933RR) - Honda HR-V 933
4. ❌ Honda Odyssey (CR106CR) - Honda Odyssey 106
5. ❌ Mazda 3 (NN371KN) - Mazda 3 371 Red
6. ❌ Mazda 6 (NN626CC) - Mazda 6 Silver 626
7. ❌ Toyota Rav 4 (EP021EP) - Rav 4 021 2022
8. ❌ Toyota Rav 4 (JU904UU) - Toyota Rav 4 904
9. ❌ Volkswagen Tiguan (GT183GG) - VW Tiguan 183 Red

#### Сервисный центр (5 машин):
1. ❌ Buick Encore (UN522UN) - Buick Encore 522
2. ❌ Hyundai Tucson (EE377EI) - Tucson Black 377
3. ❌ Hyundai Veloster (MM423QM) - Veloster 423 Orange
4. ❌ Volkswagen Jetta (HG541HG) - VW Jetta 541
5. ❌ Volkswagen Tiguan (BB681BF) - VW Tiguan 681

#### Кутаиси (3 машины):
1. ❌ Hyundai Veloster (II179IE) - Veloster 179 Yellow
2. ❌ Kia Sportage (WT572WT) - Kia Sportage 572
3. ❌ Mercedes GLS 450 (WX370WX) - Mercedes GLS 2020

#### Батуми (2 машины):
1. ❌ Kia Sportage (DF368DD) - Kia Sportage 368
2. ❌ Porsche Cayenne GTS (AR958ES) - Porsche Cayenne 958

#### Без филиала (1 машина):
1. ❌ Mini Cooper S (FH785FH) - Mini 5dr S 785

**Причина:** Эти машины не найдены в RentProg API или у них не установлены цены там.

---

## 🎯 Автоматизация через вебхуки

### Текущая ситуация:

✅ **Уже работает:**
- Единый вебхук: `https://webhook.rentflow.rentals/`
- События: `booking.*`, `car.moved`, `client.*`
- Обработка: n8n → Jarvis API → upsert в БД

❌ **Не работает:**
- Автоматическое обновление цен при их изменении в RentProg
- События изменения цен не обрабатываются

---

## 🔧 Решение: Обработка событий изменения цен

### Шаг 1: Определить тип события от RentProg

RentProg может отправлять события типа:
- `car.price.updated` - изменение цены машины
- `season.updated` - изменение сезона цен
- `price.updated` - общее событие изменения цены

**Проверить документацию RentProg:** Какие именно события они отправляют при изменении цен?

---

### Шаг 2: Создать обработчик в Jarvis API

**Файл:** `src/api/index.ts`

Добавить новый endpoint:

```typescript
// POST /process-price-event
app.post('/process-price-event', async (req, res) => {
  const { branch, type, ext_id, eventId } = req.body;

  // Валидация
  if (!branch || !ext_id) {
    return res.status(400).json({ 
      ok: false, 
      error: 'Missing branch or ext_id' 
    });
  }

  try {
    // 1. Получить car_id по ext_id
    const car = await db.query.cars.findFirst({
      where: and(
        eq(cars.branch_id, getBranchId(branch)),
        // Найти через external_refs
      )
    });

    if (!car) {
      return res.status(404).json({ 
        ok: false, 
        error: 'Car not found' 
      });
    }

    // 2. Запросить актуальные цены из RentProg API
    const token = await getRequestToken(branch);
    const carData = await fetch(
      `https://rentprog.net/api/v1/public/cars/${ext_id}`,
      { headers: { 'X-Request-Token': token } }
    ).then(r => r.json());

    // 3. Upsert цены в car_prices
    await upsertCarPrices(car.id, carData);

    // 4. Обновить событие как обработанное
    if (eventId) {
      await db.update(events)
        .set({ processed: true })
        .where(eq(events.id, eventId));
    }

    res.json({ 
      ok: true, 
      carId: car.id,
      pricesUpdated: true 
    });

  } catch (error) {
    console.error('Error processing price event:', error);
    res.status(500).json({ 
      ok: false, 
      error: error.message 
    });
  }
});
```

---

### Шаг 3: Создать n8n Workflow

**Название:** `RentProg Price Update Processor`

**Структура:**

```
[Schedule Trigger - каждые 10 минут]
    ↓
[Postgres: SELECT события price.updated WHERE processed=false]
    ↓
[Split In Batches - по 10 событий]
    ↓
[HTTP Request: POST /process-price-event]
    ↓
[Postgres: UPDATE events SET processed=true]
    ↓
[Telegram Alert - если ошибки]
```

**JSON конфигурация:**

```json
{
  "name": "RentProg Price Update Processor",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [{"field": "minutes", "minutesInterval": 10}]
        }
      },
      "name": "Every 10 minutes",
      "type": "n8n-nodes-base.scheduleTrigger",
      "position": [240, 300]
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT id, branch, type, ext_id FROM events WHERE type LIKE 'price.%' AND processed = false ORDER BY ts LIMIT 50"
      },
      "name": "Get Unprocessed Price Events",
      "type": "n8n-nodes-base.postgres",
      "credentials": { "postgres": { "id": "neon_db" }},
      "position": [460, 300]
    },
    {
      "parameters": {
        "batchSize": 10
      },
      "name": "Split In Batches",
      "type": "n8n-nodes-base.splitInBatches",
      "position": [680, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "http://46.224.17.15:3000/process-price-event",
        "options": {
          "timeout": 30000
        },
        "jsonParameters": true,
        "bodyParametersJson": "={{ { \"branch\": $json.branch, \"type\": $json.type, \"ext_id\": $json.ext_id, \"eventId\": $json.id } }}"
      },
      "name": "Process Price Event",
      "type": "n8n-nodes-base.httpRequest",
      "position": [900, 300]
    }
  ],
  "connections": {
    "Every 10 minutes": {
      "main": [[{"node": "Get Unprocessed Price Events"}]]
    },
    "Get Unprocessed Price Events": {
      "main": [[{"node": "Split In Batches"}]]
    },
    "Split In Batches": {
      "main": [[{"node": "Process Price Event"}]]
    }
  }
}
```

---

### Шаг 4: Добавить функцию upsertCarPrices

**Файл:** `src/modules/rentprog/prices.ts`

```typescript
import { db } from '../../db';
import { carPrices } from '../../db/schema';
import { eq, and } from 'drizzle-orm';

export async function upsertCarPrices(carId: string, carData: any) {
  const prices = carData.prices || [];
  const seasons = carData.seasons || [];
  const pricePeriods = carData.price_periods || [];

  if (prices.length === 0) {
    console.log(`No prices for car ${carId}`);
    return { inserted: 0, updated: 0 };
  }

  let inserted = 0;
  let updated = 0;

  for (const priceRecord of prices) {
    const seasonId = priceRecord.season_id;
    const values = priceRecord.values || [];
    
    // Пропустить если все цены = 0
    if (values.every(v => v === 0)) continue;

    // Структура price_values (JSONB)
    const priceData = {
      periods: pricePeriods,
      values: values,
      items: pricePeriods.map((period, idx) => ({
        period: period,
        price_per_day: values[idx] || 0,
        price_gel: values[idx] || 0,
        price_usd: Math.round((values[idx] / 2.7) * 100) / 100,
        currency: 'GEL'
      })),
      currency: 'GEL',
      exchange_rate: 2.7
    };

    // Добавить сезон если есть
    const season = seasons.find(s => s.id === seasonId);
    if (season) {
      priceData.season = {
        start_date: season.start_date,
        end_date: season.end_date
      };
    }

    // Проверить существование
    const existing = await db.query.carPrices.findFirst({
      where: and(
        eq(carPrices.carId, carId),
        eq(carPrices.seasonId, seasonId)
      )
    });

    if (existing) {
      // UPDATE
      await db.update(carPrices)
        .set({
          priceValues: priceData,
          rentprogPriceId: String(priceRecord.id),
          updatedAt: new Date()
        })
        .where(eq(carPrices.id, existing.id));
      updated++;
    } else {
      // INSERT
      await db.insert(carPrices).values({
        carId,
        seasonId,
        rentprogPriceId: String(priceRecord.id),
        priceValues: priceData,
        currency: 'GEL',
        exchangeRate: 2.7,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      inserted++;
    }
  }

  return { inserted, updated };
}
```

---

## 📊 Альтернативный подход: Периодическая синхронизация

Если RentProg **НЕ отправляет события изменения цен**, используйте cron:

### n8n Workflow: Daily Price Sync

```
[Schedule: Каждый день в 3:00]
    ↓
[Для каждого филиала]
    ↓
[HTTP: GET /api/cars от RentProg]
    ↓
[Для каждой машины с изменениями]
    ↓
[HTTP: POST /process-price-event]
    ↓
[Telegram: Отчет о синхронизации]
```

**Преимущества:**
- ✅ Не зависит от вебхуков
- ✅ Гарантирует актуальность цен
- ✅ Может выявить расхождения

**Недостатки:**
- ❌ Задержка до 24 часов
- ❌ Больше нагрузки на API

---

## 🎯 План внедрения

### Этап 1: Проверить документацию RentProg
- [ ] Узнать какие события они отправляют при изменении цен
- [ ] Проверить формат payload события

### Этап 2: Добавить обработчик в Jarvis API
- [ ] Создать endpoint `/process-price-event`
- [ ] Добавить функцию `upsertCarPrices`
- [ ] Протестировать на тестовых данных

### Этап 3: Создать n8n Workflow
- [ ] Создать `RentProg Price Update Processor`
- [ ] Настроить обработку событий
- [ ] Добавить Telegram алерты

### Этап 4: Альтернатива - Daily Sync
- [ ] Создать cron workflow для ежедневной синхронизации
- [ ] Добавить проверку изменений (hash/timestamp)
- [ ] Настроить отчеты

### Этап 5: Мониторинг
- [ ] Логирование всех обновлений цен
- [ ] Алерты при ошибках
- [ ] Дашборд статистики обновлений

---

## 🔍 Рекомендация

**Начните с Этапа 4 (Daily Sync)** - это проще и надежнее:

1. Создайте n8n workflow который раз в день синхронизирует цены
2. Добавьте логику определения изменений (сравнение с текущими)
3. Обновляйте только измененные цены
4. Отправляйте отчет в Telegram

**Позже**, когда будет работать базовая синхронизация, добавьте обработку вебхуков для real-time обновлений.

---

## 📝 Пример Daily Sync логики

```typescript
// Проверка нужно ли обновлять цены
async function needsPriceUpdate(carId: string, newPriceData: any): Promise<boolean> {
  const current = await db.query.carPrices.findFirst({
    where: eq(carPrices.carId, carId),
    orderBy: [desc(carPrices.updatedAt)]
  });

  if (!current) return true; // Нет цен - нужно добавить

  // Сравнить hash
  const currentHash = JSON.stringify(current.priceValues);
  const newHash = JSON.stringify(newPriceData);

  return currentHash !== newHash;
}

// Использование
if (await needsPriceUpdate(car.id, priceData)) {
  await upsertCarPrices(car.id, carData);
  console.log(`Updated prices for ${car.model}`);
}
```

---

**Документация создана:** 2025-11-09  
**Статус:** Готово к внедрению  
**Приоритет:** Средний (можно начать с daily sync)

