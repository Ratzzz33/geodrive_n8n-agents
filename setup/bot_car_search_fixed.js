/**
 * 🔧 Исправленная функция поиска автомобилей для бота
 * 
 * Проблемы, которые исправлены:
 * 1. Неправильная фильтрация технических броней (исключались ВСЕ, включая служебные)
 * 2. Неправильная проверка пересечения дат (не учитывались оба формата)
 * 3. Неправильная проверка статусов (не учитывалось поле state)
 * 4. Неправильный выбор периода цен (всегда брался первый)
 * 
 * Дата: 2025-11-17
 */

import pg from 'pg';
const { Client } = pg;

const CONNECTION_STRING = 'postgresql://bot_readonly:qNMSE5wAiPKRDYxJ719DeX9nm6Y4xWr1@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

/**
 * Найти правильный период цен для количества дней
 * 
 * @param {Array} items - Массив периодов цен из price_values.items
 * @param {number} daysCount - Количество дней аренды
 * @returns {Object|null} - Период цен или null
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
 * 
 * @param {string} branch - Код филиала ('tbilisi', 'batumi', 'kutaisi')
 * @param {string} startDate - Дата начала (ISO string, например '2025-12-28T12:00:00+04:00')
 * @param {string} endDate - Дата окончания (ISO string)
 * @param {number|null} maxPriceUSD - Максимальная цена в USD (null = без ограничения)
 * @returns {Promise<Array>} - Массив доступных автомобилей
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
    
    // 2. Получить ID филиала
    const branchResult = await client.query(
      'SELECT id, code, name FROM branches WHERE code = $1',
      [branch]
    );
    
    if (branchResult.rows.length === 0) {
      throw new Error(`Филиал ${branch} не найден`);
    }
    
    const branchId = branchResult.rows[0].id;
    
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
             AND b.start_at <= $3::timestamptz AND b.end_at >= $2::timestamptz)
            OR (b.start_date IS NOT NULL AND b.end_date IS NOT NULL
                AND b.start_date::timestamptz <= $3::timestamptz 
                AND b.end_date::timestamptz >= $2::timestamptz)
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
        continue;
      }
      
      // 5. Получить цены (без фильтра в SQL, проверка будет после парсинга)
      const priceResult = await client.query(`
        SELECT 
          id,
          season_id,
          currency,
          exchange_rate,
          price_values
        FROM car_prices
        WHERE car_id = $1
        ORDER BY season_id
        LIMIT 1
      `, [car.id]);
      
      if (priceResult.rows.length === 0) {
        continue;
      }
      
      // 6. Парсинг цен
      let priceData = priceResult.rows[0].price_values;
      if (typeof priceData === 'string') {
        priceData = JSON.parse(priceData);
      }
      
      if (!priceData?.items || priceData.items.length === 0) {
        continue;
      }
      
      // 7. ✅ НАЙТИ ПРАВИЛЬНЫЙ ПЕРИОД для количества дней
      const correctPeriod = findPriceForDays(priceData.items, daysCount);
      
      if (!correctPeriod) {
        continue;
      }
      
      const priceGEL = correctPeriod.price_gel || correctPeriod.price_per_day || 0;
      const priceUSD = correctPeriod.price_usd || (priceGEL / 2.75);
      
      // Двойная проверка цены
      if (priceGEL <= 10) {
        continue;
      }
      
      // Применить ценовой фильтр (если указан)
      if (maxPriceUSD && priceUSD > maxPriceUSD) {
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
    
    return results;
    
  } finally {
    await client.end();
  }
}

// Экспорт для использования в других модулях
export { searchCars, findPriceForDays };

// Пример использования (если запускается напрямую)
(async () => {
  try {
    const cars = await searchCars(
      'batumi',
      '2025-12-28T12:00:00+04:00',
      '2026-01-03T12:00:00+04:00',
      null // без ограничения по цене
    );
    
    console.log(`\n✅ Найдено доступных автомобилей: ${cars.length}\n`);
    
    cars.forEach((car, index) => {
      console.log(`${index + 1}. ${car.model}${car.year ? ` (${car.year})` : ''} - ${car.plate}`);
      console.log(`   🇬🇪 ${car.priceGEL}₾/день → итого ${car.totalGEL}₾ за ${car.daysCount} дней`);
      console.log(`   🇺🇸 ${car.priceUSD}$/день → итого ${car.totalUSD}$ за ${car.daysCount} дней`);
      if (car.transmission) console.log(`   ⚙️  ${car.transmission}`);
      if (car.fuel) console.log(`   ⛽ ${car.fuel}`);
      if (car.car_class) console.log(`   📊 Класс: ${car.car_class}`);
      console.log(`   📅 Период: ${car.period}`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
})();

