import postgres from 'postgres';

// Connection string для readonly пользователя
const CONNECTION_STRING = 'postgresql://bot_readonly:qNMSE5wAiPKRDYxJ719DeX9nm6Y4xWr1@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkBatumiAvailability() {
  try {
    console.log('🔍 Проверка доступных автомобилей в Батуми...\n');
    
    // Даты: 28 декабря 2025 - 3 января 2026 (6 дней)
    const startDate = '2025-12-28T12:00:00+04:00';
    const endDate = '2026-01-03T12:00:00+04:00';
    
    console.log(`📅 Период: ${startDate} - ${endDate}\n`);
    
    // 1. Получить ID филиала Батуми
    const branchResult = await sql`
      SELECT id, code, name 
      FROM branches 
      WHERE code = 'batumi'
    `;
    
    if (branchResult.length === 0) {
      console.error('❌ Филиал Батуми не найден');
      return;
    }
    
    const branchId = branchResult[0].id;
    console.log(`✅ Филиал: ${branchResult[0].name} (${branchResult[0].code})\n`);
    
    // 2. Получить ВСЕ доступные машины в Батуми (state = 1)
    const allCars = await sql`
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
      WHERE c.branch_id = ${branchId} 
        AND c.state = 1
      ORDER BY c.model, c.plate
    `;
    
    console.log(`📊 Всего доступных машин в Батуми: ${allCars.length}\n`);
    
    // 3. Проверить каждую машину на наличие броней
    const availableCars = [];
    
    for (const car of allCars) {
      // Проверка активных броней (исключаем только technical_repair)
      const bookingsCheck = await sql`
        SELECT 
          b.id,
          b.start_at,
          b.end_at,
          b.status,
          b.state,
          b.is_technical,
          b.technical_type,
          b.client_name
        FROM bookings b
        WHERE b.car_id = ${car.id}
          AND (
            -- Активные статусы (русские и английские)
            b.state IN ('Активная', 'Новая', 'Подтверждена')
            OR b.status IN ('active', 'confirmed', 'in_rent', 'Активная', 'Новая', 'Подтверждена')
          )
          AND (
            -- Проверка пересечения дат
            (b.start_at <= ${endDate}::timestamptz AND b.end_at >= ${startDate}::timestamptz)
            OR (b.start_date::timestamptz <= ${endDate}::timestamptz AND b.end_date::timestamptz >= ${startDate}::timestamptz)
          )
          AND (
            -- Исключаем только технические брони для ремонта
            -- Служебные поездки (technical_type = 'technical') НЕ блокируют
            b.technical_type = 'technical_repair'
            OR (b.is_technical = FALSE OR b.technical_type IS NULL OR b.technical_type = 'regular')
          )
      `;
      
      // Если есть блокирующие брони - пропускаем
      if (bookingsCheck.length > 0) {
        console.log(`❌ ${car.model} (${car.plate}) - ЗАНЯТА:`);
        bookingsCheck.forEach(b => {
          console.log(`   - ${b.start_at} - ${b.end_at} (${b.status || b.state}) ${b.is_technical ? `[${b.technical_type}]` : ''} ${b.client_name || ''}`);
        });
        continue;
      }
      
      // 4. Проверить наличие цен
      const pricesCheck = await sql`
        SELECT 
          id,
          season_id,
          currency,
          exchange_rate,
          price_values
        FROM car_prices
        WHERE car_id = ${car.id}
        ORDER BY season_id
        LIMIT 1
      `;
      
      if (pricesCheck.length === 0) {
        console.log(`⚠️  ${car.model} (${car.plate}) - НЕТ ЦЕН`);
        continue;
      }
      
      // Парсинг цен
      let priceData = pricesCheck[0].price_values;
      if (typeof priceData === 'string') {
        priceData = JSON.parse(priceData);
      }
      
      // Получить цену для 6 дней
      const items = priceData?.items || [];
      if (items.length === 0) {
        console.log(`⚠️  ${car.model} (${car.plate}) - НЕТ ЦЕН В ITEMS`);
        continue;
      }
      
      // Найти правильный период для 6 дней
      // Периоды обычно: "1 - 2", "3 - 4", "5 - 7", "8 - 15", "16 - 30"
      let selectedPeriod = items[0]; // По умолчанию первый
      for (const item of items) {
        const period = item.period || '';
        if (period.includes('5') || period.includes('7')) {
          // Период 5-7 дней подходит для 6 дней
          selectedPeriod = item;
          break;
        }
      }
      
      const priceGEL = selectedPeriod.price_gel || selectedPeriod.price_per_day || 0;
      const priceUSD = selectedPeriod.price_usd || (priceGEL / 2.75);
      const totalGEL = priceGEL * 6;
      const totalUSD = priceUSD * 6;
      
      if (priceGEL <= 10) {
        console.log(`⚠️  ${car.model} (${car.plate}) - ЦЕНА СЛИШКОМ НИЗКАЯ (${priceGEL} GEL)`);
        continue;
      }
      
      availableCars.push({
        model: car.model,
        plate: car.plate,
        code: car.code,
        year: car.year,
        transmission: car.transmission,
        fuel: car.fuel,
        car_class: car.car_class,
        priceGEL: Math.round(priceGEL * 100) / 100,
        priceUSD: Math.round(priceUSD * 100) / 100,
        totalGEL: Math.round(totalGEL * 100) / 100,
        totalUSD: Math.round(totalUSD * 100) / 100,
        period: selectedPeriod.period || 'N/A'
      });
    }
    
    // 5. Вывести результаты
    console.log('\n' + '='.repeat(80));
    console.log(`✅ НАЙДЕНО ДОСТУПНЫХ АВТОМОБИЛЕЙ: ${availableCars.length}`);
    console.log('='.repeat(80) + '\n');
    
    if (availableCars.length === 0) {
      console.log('❌ Нет доступных автомобилей на указанные даты');
    } else {
      // Сортировка по цене
      availableCars.sort((a, b) => a.priceGEL - b.priceGEL);
      
      availableCars.forEach((car, index) => {
        console.log(`${index + 1}. ${car.model}${car.year ? ` (${car.year})` : ''} - ${car.plate || car.code || 'N/A'}`);
        console.log(`   🇬🇪 ${car.priceGEL}₾/день → итого ${car.totalGEL}₾ за 6 дней`);
        console.log(`   🇺🇸 ${car.priceUSD}$/день → итого ${car.totalUSD}$ за 6 дней`);
        if (car.transmission) console.log(`   ⚙️  ${car.transmission}`);
        if (car.fuel) console.log(`   ⛽ ${car.fuel}`);
        if (car.car_class) console.log(`   📊 Класс: ${car.car_class}`);
        console.log(`   📅 Период: ${car.period}`);
        console.log('');
      });
      
      // Сравнение с найденными ботом
      console.log('\n' + '='.repeat(80));
      console.log('🔍 СРАВНЕНИЕ С РЕЗУЛЬТАТАМИ БОТА:');
      console.log('='.repeat(80) + '\n');
      
      const botFound = ['Hyundai Veloster', 'Honda Fit EX'];
      const foundByBot = availableCars.filter(c => 
        botFound.some(bf => c.model.toLowerCase().includes(bf.toLowerCase()))
      );
      const notFoundByBot = availableCars.filter(c => 
        !botFound.some(bf => c.model.toLowerCase().includes(bf.toLowerCase()))
      );
      
      console.log(`✅ Найдено ботом: ${foundByBot.length}`);
      foundByBot.forEach(c => console.log(`   - ${c.model} (${c.plate})`));
      
      if (notFoundByBot.length > 0) {
        console.log(`\n❌ НЕ найдено ботом (${notFoundByBot.length}):`);
        notFoundByBot.forEach(c => {
          console.log(`   - ${c.model} (${c.plate}) - ${c.priceGEL}₾/день (${c.totalGEL}₾ за 6 дней)`);
        });
      } else {
        console.log('\n✅ Бот нашел все доступные автомобили!');
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

// Запуск
checkBatumiAvailability();

