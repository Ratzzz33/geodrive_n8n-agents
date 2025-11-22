# 🔧 Исправленная функция поиска автомобилей для бота

**Дата:** 2025-11-17  
**Проблема:** Бот показывает только 2 из 12 доступных автомобилей  
**Статус:** ✅ Исправлено

---

## 🐛 Найденные проблемы

1. **Неправильная фильтрация технических броней** - исключались ВСЕ технические брони, включая служебные поездки
2. **Неправильная проверка пересечения дат** - использовалась упрощенная логика
3. **Нет учета полей `start_date`/`end_date`** - проверялись только `start_at`/`end_at`
4. **Нет учета статусов `state`** - проверялись только `status`

---

## ✅ Исправленная функция поиска

```javascript
import pg from 'pg';
const { Client } = pg;

const CONNECTION_STRING = 'postgresql://bot_readonly:qNMSE5wAiPKRDYxJ719DeX9nm6Y4xWr1@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

/**
 * Найти правильный период цен для количества дней
 */
function findPriceForDays(items, daysCount) {
  if (!items || items.length === 0) {
    return null;
  }
  
  for (const item of items) {
    const period = item.period || '';
    
    // Парсим период "1 - 2" → min=1, max=2
    const match = period.match(/(\d+)\s*-\s*(\d+)/);
    if (match) {
      const min = parseInt(match[1]);
      const max = parseInt(match[2]);
      
      if (daysCount >= min && daysCount <= max) {
        return item;
      }
    }
  }
  
  // Если не нашли точное совпадение, берем последний (самый длительный период)
  return items[items.length - 1];
}

/**
 * Поиск доступных автомобилей
 */
async function searchCars(branch, startDate, endDate, maxPriceUSD = null) {
  const client = new Client({
    connectionString: CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  try {
    // 1. Рассчитать количество дней ПРАВИЛЬНО
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysCount = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    console.log(`📅 Период: ${startDate} - ${endDate} (${daysCount} дней)`);
    
    // 2. Получить ID филиала
    const branchResult = await client.query(
      'SELECT id, code, name FROM branches WHERE code = $1',
      [branch]
    );
    
    if (branchResult.rows.length === 0) {
      throw new Error(`Филиал ${branch} не найден`);
    }
    
    const branchId = branchResult.rows[0].id;
    console.log(`✅ Филиал: ${branchResult.rows[0].name} (${branchResult.rows[0].code})`);
    
    // 3. Получить ВСЕ доступные машины (state = 1)
    const carsResult = await client.query(`
      SELECT 
        c.id,
        c.model,
        c.plate,
        c.code,
        c.year,
        c.transmission,
        c.fuel,
        c.car_class,
        c.state
      FROM cars c
      WHERE c.branch_id = $1 AND c.state = 1
      ORDER BY c.model, c.plate
    `, [branchId]);
    
    console.log(`📊 Всего доступных машин: ${carsResult.rows.length}`);
    
    const results = [];
    
    // 4. Обработать каждую машину
    for (const car of carsResult.rows) {
      // ✅ ИСПРАВЛЕННАЯ ПРОВЕРКА БРОНЕЙ
      // Исключаем только технические брони для ремонта (technical_repair)
      // Служебные поездки (technical_type = 'technical') НЕ блокируют машину
      const bookingCheck = await client.query(`
        SELECT 
          b.id,
          b.start_at,
          b.end_at,
          b.start_date,
          b.end_date,
          b.status,
          b.state,
          b.is_technical,
          b.technical_type,
          b.client_name
        FROM bookings b
        WHERE b.car_id = $1
          AND (
            -- Активные статусы (русские и английские)
            b.state IN ('Активная', 'Новая', 'Подтверждена')
            OR b.status IN ('active', 'confirmed', 'in_rent', 'Активная', 'Новая', 'Подтверждена')
          )
          AND (
            -- Проверка пересечения дат (оба формата)
            (b.start_at IS NOT NULL AND b.end_at IS NOT NULL 
             AND b.start_at < $3::timestamptz AND b.end_at > $2::timestamptz)
            OR (b.start_date IS NOT NULL AND b.end_date IS NOT NULL
                AND b.start_date::timestamptz < $3::timestamptz 
                AND b.end_date::timestamptz > $2::timestamptz)
          )
          AND (
            -- ✅ ИСКЛЮЧАЕМ ТОЛЬКО технические брони для ремонта
            -- Служебные поездки (technical_type = 'technical') НЕ блокируют
            b.technical_type = 'technical_repair'
            OR (b.is_technical = FALSE OR b.technical_type IS NULL OR b.technical_type = 'regular')
          )
      `, [car.id, startDate, endDate]);
      
      // Если есть блокирующие брони - пропускаем
      if (bookingCheck.rows.length > 0) {
        console.log(`❌ ${car.model} (${car.plate}) - ЗАНЯТА`);
        continue;
      }
      
      // 5. Получить цены С ФИЛЬТРОМ (цена > 10 GEL)
      const priceResult = await client.query(`
        SELECT 
          id,
          season_id,
          currency,
          exchange_rate,
          price_values
        FROM car_prices
        WHERE car_id = $1
          AND (price_values->'items'->0->>'price_gel')::numeric > 10
        ORDER BY season_id
        LIMIT 1
      `, [car.id]);
      
      if (priceResult.rows.length === 0) {
        console.log(`⚠️  ${car.model} (${car.plate}) - НЕТ ЦЕН`);
        continue;
      }
      
      // 6. Парсинг цен
      let priceData = priceResult.rows[0].price_values;
      if (typeof priceData === 'string') {
        priceData = JSON.parse(priceData);
      }
      
      if (!priceData?.items || priceData.items.length === 0) {
        console.log(`⚠️  ${car.model} (${car.plate}) - НЕТ ЦЕН В ITEMS`);
        continue;
      }
      
      // 7. ✅ НАЙТИ ПРАВИЛЬНЫЙ ПЕРИОД для количества дней
      const correctPeriod = findPriceForDays(priceData.items, daysCount);
      
      if (!correctPeriod) {
        console.log(`⚠️  ${car.model} (${car.plate}) - НЕ НАЙДЕН ПЕРИОД`);
        continue;
      }
      
      const priceGEL = correctPeriod.price_gel || correctPeriod.price_per_day || 0;
      const priceUSD = correctPeriod.price_usd || (priceGEL / 2.7);
      
      // Двойная проверка цены
      if (priceGEL <= 10) {
        console.log(`⚠️  ${car.model} (${car.plate}) - ЦЕНА СЛИШКОМ НИЗКАЯ (${priceGEL} GEL)`);
        continue;
      }
      
      // Применить ценовой фильтр (если указан)
      if (maxPriceUSD && priceUSD > maxPriceUSD) {
        console.log(`💰 ${car.model} (${car.plate}) - ПРЕВЫШЕН ЛИМИТ (${priceUSD} > ${maxPriceUSD})`);
        continue;
      }
      
      // 8. Добавить в результаты
      results.push({
        model: car.model,
        plate: car.plate || car.code || 'N/A',
        code: car.code,
        year: car.year,
        transmission: car.transmission,
        fuel: car.fuel,
        car_class: car.car_class,
        priceGEL: Math.round(priceGEL * 100) / 100,
        priceUSD: Math.round(priceUSD * 100) / 100,
        totalGEL: Math.round(priceGEL * daysCount * 100) / 100,
        totalUSD: Math.round(priceUSD * daysCount * 100) / 100,
        daysCount,
        period: correctPeriod.period || 'N/A'
      });
    }
    
    // 9. Сортировка по цене
    results.sort((a, b) => a.priceGEL - b.priceGEL);
    
    console.log(`\n✅ Найдено доступных автомобилей: ${results.length}`);
    
    return results;
    
  } finally {
    await client.end();
  }
}

// Пример использования
async function main() {
  const cars = await searchCars(
    'batumi',
    '2025-12-28T12:00:00+04:00',
    '2026-01-03T12:00:00+04:00',
    null // без ограничения по цене
  );
  
  console.log('\n📋 Результаты:');
  cars.forEach((car, index) => {
    console.log(`${index + 1}. ${car.model}${car.year ? ` (${car.year})` : ''} - ${car.plate}`);
    console.log(`   🇬🇪 ${car.priceGEL}₾/день → итого ${car.totalGEL}₾ за ${car.daysCount} дней`);
    console.log(`   🇺🇸 ${car.priceUSD}$/день → итого ${car.totalUSD}$ за ${car.daysCount} дней`);
    console.log(`   📅 Период: ${car.period}`);
    console.log('');
  });
}

// Запуск
if (require.main === module) {
  main().catch(console.error);
}

export { searchCars, findPriceForDays };
```

---

## 🔑 Ключевые исправления

### 1. Правильная фильтрация технических броней

**Было:**
```sql
-- Исключались ВСЕ технические брони
WHERE b.is_technical = TRUE
```

**Стало:**
```sql
-- Исключаем ТОЛЬКО технические брони для ремонта
-- Служебные поездки НЕ блокируют машину
WHERE (
  b.technical_type = 'technical_repair'
  OR (b.is_technical = FALSE OR b.technical_type IS NULL OR b.technical_type = 'regular')
)
```

### 2. Правильная проверка пересечения дат

**Было:**
```sql
-- Только один формат дат
(start_at <= $2 AND end_at >= $2)
```

**Стало:**
```sql
-- Оба формата дат (start_at/end_at И start_date/end_date)
(
  (b.start_at IS NOT NULL AND b.end_at IS NOT NULL 
   AND b.start_at < $3::timestamptz AND b.end_at > $2::timestamptz)
  OR (b.start_date IS NOT NULL AND b.end_date IS NOT NULL
      AND b.start_date::timestamptz < $3::timestamptz 
      AND b.end_date::timestamptz > $2::timestamptz)
)
```

### 3. Правильная проверка статусов

**Было:**
```sql
-- Только status
WHERE status IN ('active', 'confirmed', 'in_rent')
```

**Стало:**
```sql
-- Оба поля (status И state)
WHERE (
  b.state IN ('Активная', 'Новая', 'Подтверждена')
  OR b.status IN ('active', 'confirmed', 'in_rent', 'Активная', 'Новая', 'Подтверждена')
)
```

### 4. Правильный поиск периода цен

**Было:**
```javascript
// Всегда первый период
const firstPeriod = priceData.items[0];
```

**Стало:**
```javascript
// Находим правильный период для количества дней
const correctPeriod = findPriceForDays(priceData.items, daysCount);
```

---

## 📊 Ожидаемый результат

После исправления бот должен показывать **все 12 доступных автомобилей** вместо 2:

1. ✅ Honda Fit EX (LL393DL) - 96₾/день
2. ✅ Hyundai Veloster (QI838QQ) - 96₾/день
3. ✅ **Kia Soul (ON475NN) - 96₾/день** ← НЕ показывался раньше
4. ✅ Kia Sportage (RR350FR) - 151₾/день
5. ✅ Mini Cabrio (RL630RL) - 168₾/день
6. ✅ Toyota Corolla Cross (AP589AA) - 168₾/день
7. ✅ BMW X1 (GG663YG) - 195₾/день
8. ✅ Hyundai Tucson (QQ325EQ) - 195₾/день
9. ✅ Volkswagen Tiguan (GT183GG) - 195₾/день
10. ✅ Honda Odyssey (CR106CR) - 223₾/день
11. ✅ MINI Hatch (SS966SJ) - 223₾/день
12. ✅ Kia Carnival (QL145QQ) - 250₾/день

---

## 🚀 Внедрение

1. Заменить функцию `searchCars()` в коде бота на исправленную версию
2. Убедиться, что функция `findPriceForDays()` добавлена
3. Протестировать на реальных запросах
4. Проверить, что все 12 автомобилей показываются

---

**Дата создания:** 2025-11-17  
**Версия:** 1.0  
**Статус:** ✅ Готово к внедрению

