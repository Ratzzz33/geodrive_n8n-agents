/**
 * Проверка ВСЕХ цен для конкретных машин
 */

import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

const plates = ['CX036CX', 'OO700JO', 'DK700DK', 'AP589AA', 'BI355II'];

console.log('🔍 Проверка ВСЕХ цен для машин...\n');

try {
  for (const plate of plates) {
    // Получить все цены для этой машины
    const prices = await sql`
      SELECT 
        c.model,
        c.plate,
        cp.season_id,
        cp.price_values,
        cp.created_at
      FROM cars c
      JOIN car_prices cp ON cp.car_id = c.id
      WHERE c.plate = ${plate}
      ORDER BY cp.season_id
    `;

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`${prices[0]?.model || 'Unknown'} (${plate})`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    if (prices.length === 0) {
      console.log('❌ Цены не найдены!\n');
      continue;
    }

    console.log(`Найдено записей цен: ${prices.length}\n`);

    prices.forEach((price, idx) => {
      console.log(`Запись #${idx + 1} (season_id: ${price.season_id}):`);
      
      let priceData = price.price_values;
      if (typeof priceData === 'string') {
        priceData = JSON.parse(priceData);
      }

      if (!priceData.items || priceData.items.length === 0) {
        console.log('   ❌ Нет данных items\n');
        return;
      }

      const firstItem = priceData.items[0];
      const priceGel = firstItem.price_gel || firstItem.price_per_day || 0;
      
      console.log(`   Цена 1-2 дней: ${priceGel} GEL (≈$${firstItem.price_usd || (priceGel / 2.7).toFixed(2)})`);
      
      // Проверка - это нормальная цена?
      if (priceGel <= 10) {
        console.log('   ⚠️  Подозрительно низкая цена (<=10 GEL)');
      } else {
        console.log('   ✅ Нормальная цена');
      }

      // Показать сезон если есть
      if (priceData.season) {
        console.log(`   📅 Сезон: ${priceData.season.start_date} - ${priceData.season.end_date}`);
      }

      console.log('');
    });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 ВЫВОД:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

} catch (error) {
  console.error('❌ Ошибка:', error.message);
} finally {
  await sql.end();
}

