/**
 * Проверка машин с подозрительно низкими ценами (1 GEL)
 */

import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

console.log('🔍 Проверка машин с ценой 1 GEL...\n');

try {
  // Ищем машины BMW X1, Mercedes GLS, Toyota Camry, Toyota Corolla Cross, VW Beetle
  const suspiciousCars = await sql`
    SELECT 
      c.model,
      c.plate,
      c.code,
      cp.price_values
    FROM cars c
    JOIN car_prices cp ON cp.car_id = c.id
    WHERE c.plate IN ('CX036CX', 'OO700JO', 'DK700DK', 'AP589AA', 'BI355II')
    ORDER BY c.plate
  `;

  console.log(`Найдено ${suspiciousCars.length} машин\n`);

  for (const car of suspiciousCars) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`${car.model} (${car.plate})`);
    console.log(`Код: ${car.code}\n`);

    let priceData = car.price_values;
    if (typeof priceData === 'string') {
      priceData = JSON.parse(priceData);
    }

    console.log('📊 price_values:');
    console.log(JSON.stringify(priceData, null, 2));
    console.log('');

    if (priceData.items) {
      console.log('💰 Цены по периодам:');
      priceData.items.forEach((item, idx) => {
        console.log(`   ${idx + 1}. ${item.period}: ${item.price_gel || item.price_per_day} GEL (≈$${item.price_usd || 'N/A'})`);
      });
      console.log('');
    }

    // Проверка - все ли цены = 1?
    if (priceData.items) {
      const allPricesOne = priceData.items.every(item => {
        const price = item.price_gel || item.price_per_day || 0;
        return price === 1;
      });

      if (allPricesOne) {
        console.log('⚠️  ПРОБЛЕМА: Все цены = 1 GEL (тестовые/мусорные данные)');
      }
    }

    console.log('');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 ВЫВОД:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('Косяк скорее всего в том, что:');
  console.log('');
  console.log('1️⃣  В БД есть записи с price = 1 GEL (тестовые данные из RentProg)');
  console.log('2️⃣  Бот НЕ фильтрует эти мусорные цены');
  console.log('3️⃣  Нужно добавить в запрос бота фильтр:');
  console.log('');
  console.log('   WHERE (price_values->\'items\'->0->>\'price_gel\')::numeric > 10');
  console.log('');
  console.log('   Или в коде после получения данных:');
  console.log('');
  console.log('   if (priceGEL <= 10) continue; // Пропустить тестовые цены');
  console.log('');

} catch (error) {
  console.error('❌ Ошибка:', error.message);
} finally {
  await sql.end();
}

