/**
 * Проверка других машин, чтобы понять, были ли поля заполнены ранее
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkOtherCars() {
  console.log('🔍 Проверяю другие машины, чтобы понять, были ли поля заполнены ранее...\n');

  try {
    // Проверяем машины, которые НЕ обновлялись недавно (до 17 ноября)
    console.log('📋 Машины, которые НЕ обновлялись после 17 ноября:');
    const oldCars = await sql`
      SELECT 
        rentprog_id,
        car_name,
        code,
        updated_at,
        deposit,
        price_hour,
        hourly_deposit,
        monthly_deposit,
        investor_id,
        purchase_price,
        purchase_date,
        age_limit,
        driver_year_limit
      FROM cars
      WHERE updated_at < '2025-11-17 00:00:00'
        AND rentprog_id IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 10
    `;

    if (oldCars.length > 0) {
      console.log(`   Найдено ${oldCars.length} машин, которые не обновлялись после 17 ноября:\n`);
      oldCars.forEach((car, idx) => {
        const hasValues = car.deposit !== null || car.price_hour !== null || car.investor_id !== null;
        const status = hasValues ? '✅' : '⚠️';
        console.log(`   ${status} ${idx + 1}. ${car.car_name} (${car.code}) - updated: ${car.updated_at}`);
        if (hasValues) {
          console.log(`      deposit=${car.deposit}, price_hour=${car.price_hour}, investor_id=${car.investor_id}`);
        }
      });
    } else {
      console.log(`   ⚠️  Не найдено машин, которые не обновлялись после 17 ноября`);
    }

    // Проверяем машины с заполненными полями
    console.log('\n📋 Машины с заполненными полями (deposit, price_hour, investor_id):');
    const carsWithValues = await sql`
      SELECT 
        rentprog_id,
        car_name,
        code,
        updated_at,
        deposit,
        price_hour,
        investor_id
      FROM cars
      WHERE (deposit IS NOT NULL OR price_hour IS NOT NULL OR investor_id IS NOT NULL)
        AND rentprog_id IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 10
    `;

    if (carsWithValues.length > 0) {
      console.log(`   Найдено ${carsWithValues.length} машин с заполненными полями:\n`);
      carsWithValues.forEach((car, idx) => {
        console.log(`   ✅ ${idx + 1}. ${car.car_name} (${car.code}) - updated: ${car.updated_at}`);
        console.log(`      deposit=${car.deposit}, price_hour=${car.price_hour}, investor_id=${car.investor_id}`);
      });
    } else {
      console.log(`   ⚠️  Не найдено машин с заполненными полями`);
    }

    // Статистика по всем машинам
    console.log('\n📊 Статистика по всем машинам:');
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(deposit) as has_deposit,
        COUNT(price_hour) as has_price_hour,
        COUNT(investor_id) as has_investor_id,
        COUNT(purchase_price) as has_purchase_price,
        COUNT(age_limit) as has_age_limit
      FROM cars
      WHERE rentprog_id IS NOT NULL
    `;

    if (stats.length > 0) {
      const s = stats[0];
      console.log(`   Всего машин: ${s.total}`);
      console.log(`   С deposit: ${s.has_deposit} (${Math.round(s.has_deposit / s.total * 100)}%)`);
      console.log(`   С price_hour: ${s.has_price_hour} (${Math.round(s.has_price_hour / s.total * 100)}%)`);
      console.log(`   С investor_id: ${s.has_investor_id} (${Math.round(s.has_investor_id / s.total * 100)}%)`);
      console.log(`   С purchase_price: ${s.has_purchase_price} (${Math.round(s.has_purchase_price / s.total * 100)}%)`);
      console.log(`   С age_limit: ${s.has_age_limit} (${Math.round(s.has_age_limit / s.total * 100)}%)`);
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

checkOtherCars()
  .then(() => {
    console.log('\n✅ Проверка завершена');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });

