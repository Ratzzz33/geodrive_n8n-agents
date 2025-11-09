/**
 * Проверка логики выбора периода цен
 * Для 3 дней аренды (12-15 ноября) должен использоваться период "3-4 дня", а не "1-2"
 */

import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

async function checkPricePeriodLogic() {
  console.log('🔍 Проверка логики выбора периода цен...\n');
  console.log('Период аренды: 12-15 ноября (3 дня)\n');

  try {
    // Проверим Ford Fiesta
    const car = await sql`
    SELECT 
      c.model,
      c.plate,
      cp.price_values
    FROM cars c
    JOIN car_prices cp ON cp.car_id = c.id
    WHERE c.plate = 'JG722GJ'
    LIMIT 1
  `;

  if (car.length === 0) {
    console.log('❌ Машина не найдена');
    return;
  }

  let priceData = car[0].price_values;
  if (typeof priceData === 'string') {
    priceData = JSON.parse(priceData);
  }

  console.log(`📋 ${car[0].model} (${car[0].plate})`);
  console.log('');
  console.log('💰 Цены по периодам:');
  console.log('');
  
  priceData.items.forEach((item, idx) => {
    console.log(`   ${idx}. ${item.period} дней: ${item.price_gel} GEL (≈$${item.price_usd})`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🐛 ПОТЕНЦИАЛЬНАЯ ОШИБКА В БОТЕ:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const firstPeriod = priceData.items[0];
  console.log(`❌ Если бот берет ПЕРВЫЙ период (items[0]):`);
  console.log(`   Период: ${firstPeriod.period}`);
  console.log(`   Цена: ${firstPeriod.price_gel} GEL (≈$${firstPeriod.price_usd})`);
  console.log(`   Итого за 3 дня: ${firstPeriod.price_gel * 3} GEL (≈$${(firstPeriod.price_usd * 3).toFixed(2)})`);
  console.log('');

  // Правильная логика - найти подходящий период
  function findPriceForDays(items, days) {
    for (let item of items) {
      const [min, max] = item.period.split(' - ').map(s => parseInt(s.trim()));
      if (days >= min && days <= max) {
        return item;
      }
    }
    return items[items.length - 1]; // Последний период если не нашли
  }

  const correctPeriod = findPriceForDays(priceData.items, 3);
  console.log(`✅ ПРАВИЛЬНАЯ логика для 3 дней:`);
  console.log(`   Период: ${correctPeriod.period}`);
  console.log(`   Цена: ${correctPeriod.price_gel} GEL (≈$${correctPeriod.price_usd})`);
  console.log(`   Итого за 3 дня: ${correctPeriod.price_gel * 3} GEL (≈$${(correctPeriod.price_usd * 3).toFixed(2)})`);
  console.log('');

  const priceDiff = firstPeriod.price_gel - correctPeriod.price_gel;
  const totalDiff = priceDiff * 3;

  if (priceDiff !== 0) {
    console.log(`⚠️  РАЗНИЦА:`);
    console.log(`   ${Math.abs(priceDiff)} GEL/день`);
    console.log(`   ${Math.abs(totalDiff)} GEL за весь период (≈$${Math.abs(totalDiff / 2.7).toFixed(2)})`);
    console.log('');
    if (priceDiff > 0) {
      console.log(`   ❌ Бот показывает цену ВЫШЕ чем должна быть`);
    } else {
      console.log(`   ❌ Бот показывает цену НИЖЕ чем должна быть`);
    }
  } else {
    console.log(`✅ В данном случае цены совпадают`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 ВЫВОД:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('Если бот всегда берет items[0] (первый период),');
  console.log('то это ОШИБКА в логике!');
  console.log('');
  console.log('Нужно искать подходящий период по длительности аренды:');
  console.log('');
  console.log('function findPriceForDays(items, days) {');
  console.log('  for (let item of items) {');
  console.log('    const [min, max] = item.period.split(" - ").map(Number);');
  console.log('    if (days >= min && days <= max) {');
  console.log('      return item;');
  console.log('    }');
  console.log('  }');
  console.log('  return items[items.length - 1]; // Последний период');
  console.log('}');
  console.log('');
  console.log('const daysCount = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));');
  console.log('const correctPeriod = findPriceForDays(priceData.items, daysCount);');
  console.log('');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
}

checkPricePeriodLogic();

