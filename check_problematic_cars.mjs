/**
 * Полный список машин без цен или с нереальными ценами
 */

import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

console.log('🔍 Поиск проблемных машин...\n');

try {
  // Машины БЕЗ цен вообще
  const noPrices = await sql`
    SELECT 
      c.id,
      c.model,
      c.plate,
      c.code,
      b.code as branch_code,
      b.name as branch_name,
      c.state
    FROM cars c
    LEFT JOIN branches b ON b.id = c.branch_id
    LEFT JOIN car_prices cp ON cp.car_id = c.id
    WHERE cp.id IS NULL
      AND c.state = 1
    ORDER BY b.code, c.model
  `;

  // Машины с нереальными ценами (<=10 GEL)
  const unrealisticPrices = await sql`
    SELECT 
      c.id,
      c.model,
      c.plate,
      c.code,
      b.code as branch_code,
      b.name as branch_name,
      cp.price_values,
      c.state
    FROM cars c
    JOIN branches b ON b.id = c.branch_id
    JOIN car_prices cp ON cp.car_id = c.id
    WHERE c.state = 1
      AND (cp.price_values->'items'->0->>'price_gel')::numeric <= 10
    ORDER BY b.code, c.model
  `;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1️⃣  МАШИНЫ БЕЗ ЦЕН (полностью отсутствуют в car_prices)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (noPrices.length === 0) {
    console.log('✅ Нет машин без цен\n');
  } else {
    console.log(`Найдено: ${noPrices.length} машин\n`);
    
    let currentBranch = '';
    noPrices.forEach(car => {
      if (car.branch_code !== currentBranch) {
        currentBranch = car.branch_code;
        console.log(`\n📍 ${car.branch_name || 'Без филиала'} (${car.branch_code || 'N/A'}):`);
      }
      console.log(`   ❌ ${car.model} (${car.plate}) - ${car.code || 'N/A'}`);
    });
    console.log('');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('2️⃣  МАШИНЫ С НЕРЕАЛЬНЫМИ ЦЕНАМИ (≤10 GEL)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (unrealisticPrices.length === 0) {
    console.log('✅ Нет машин с нереальными ценами\n');
  } else {
    console.log(`Найдено: ${unrealisticPrices.length} машин\n`);
    
    let currentBranch = '';
    unrealisticPrices.forEach(car => {
      if (car.branch_code !== currentBranch) {
        currentBranch = car.branch_code;
        console.log(`\n📍 ${car.branch_name || 'Без филиала'} (${car.branch_code || 'N/A'}):`);
      }
      
      let priceData = car.price_values;
      if (typeof priceData === 'string') {
        priceData = JSON.parse(priceData);
      }
      const priceGEL = priceData.items?.[0]?.price_gel || priceData.items?.[0]?.price_per_day || 0;
      
      console.log(`   ⚠️  ${car.model} (${car.plate}) - ${car.code || 'N/A'} - цена: ${priceGEL} GEL`);
    });
    console.log('');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 ИТОГОВАЯ СТАТИСТИКА');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`Машины без цен: ${noPrices.length}`);
  console.log(`Машины с нереальными ценами: ${unrealisticPrices.length}`);
  console.log(`Всего проблемных: ${noPrices.length + unrealisticPrices.length}\n`);

  // Статистика по филиалам
  const branchStats = {};
  
  noPrices.forEach(car => {
    const branch = car.branch_code || 'unknown';
    if (!branchStats[branch]) branchStats[branch] = { noPrices: 0, unrealistic: 0 };
    branchStats[branch].noPrices++;
  });

  unrealisticPrices.forEach(car => {
    const branch = car.branch_code || 'unknown';
    if (!branchStats[branch]) branchStats[branch] = { noPrices: 0, unrealistic: 0 };
    branchStats[branch].unrealistic++;
  });

  console.log('По филиалам:');
  Object.entries(branchStats).forEach(([branch, stats]) => {
    console.log(`  ${branch}: без цен: ${stats.noPrices}, нереальные: ${stats.unrealistic}`);
  });
  console.log('');

} catch (error) {
  console.error('❌ Ошибка:', error.message);
} finally {
  await sql.end();
}

