import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

const USD_TO_GEL = 2.7;

try {
  console.log('Обновляю данные о ценах...\n');
  
  // 1. Добавить поле currency в car_prices
  console.log('1. Добавляю поле currency в таблицу car_prices...');
  await sql`
    ALTER TABLE car_prices 
    ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'GEL'
  `;
  
  console.log('2. Добавляю поле exchange_rate...');
  await sql`
    ALTER TABLE car_prices 
    ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(10,4) DEFAULT 2.7
  `;
  
  console.log('3. Обновляю существующие записи...');
  await sql`
    UPDATE car_prices 
    SET currency = 'GEL',
        exchange_rate = ${USD_TO_GEL}
    WHERE currency IS NULL
  `;
  
  // 4. Обновить price_values чтобы добавить валюту в структуру
  console.log('4. Обновляю структуру price_values...');
  
  const allPrices = await sql`
    SELECT id, price_values 
    FROM car_prices 
    WHERE price_values IS NOT NULL
  `;
  
  console.log(`   Обновляю ${allPrices.length} записей...`);
  
  let updated = 0;
  for (const record of allPrices) {
    const priceData = record.price_values;
    
    if (!priceData || !priceData.items) continue;
    
    // Добавить информацию о валюте и USD эквивалент
    const updatedItems = priceData.items.map(item => ({
      ...item,
      price_gel: item.price_per_day,
      price_usd: Math.round((item.price_per_day / USD_TO_GEL) * 100) / 100,
      currency: 'GEL'
    }));
    
    const updatedData = {
      ...priceData,
      items: updatedItems,
      currency: 'GEL',
      exchange_rate: USD_TO_GEL
    };
    
    await sql`
      UPDATE car_prices 
      SET price_values = ${JSON.stringify(updatedData)}
      WHERE id = ${record.id}
    `;
    
    updated++;
  }
  
  console.log(`   ✓ Обновлено ${updated} записей\n`);
  
  console.log('✅ Миграция завершена!\n');
  
  // Показать пример обновленной записи
  console.log('Пример обновленной записи:');
  const sample = await sql`
    SELECT 
      c.model,
      c.plate,
      cp.currency,
      cp.exchange_rate,
      cp.price_values->'items' as items
    FROM car_prices cp
    JOIN cars c ON c.id = cp.car_id
    LIMIT 1
  `;
  
  if (sample.length > 0) {
    console.log(`\n${sample[0].model} (${sample[0].plate})`);
    console.log(`Валюта: ${sample[0].currency}`);
    console.log(`Курс: 1 USD = ${sample[0].exchange_rate} GEL`);
    console.log('\nПримеры цен:');
    if (sample[0].items && sample[0].items.length > 0) {
      sample[0].items.slice(0, 3).forEach(item => {
        console.log(`  ${item.period}: ${item.price_gel} GEL (≈$${item.price_usd})`);
      });
    }
  }
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  console.error(error);
} finally {
  await sql.end();
}

