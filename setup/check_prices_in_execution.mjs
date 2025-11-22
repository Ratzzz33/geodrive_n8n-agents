import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkPrices() {
  console.log('🔍 Проверка сохранения цен в последнем execution...\n');
  
  try {
    // 1. Проверяем, сколько цен было сохранено недавно
    console.log('1️⃣ Проверка последних сохраненных цен:\n');
    
    const recentPrices = await sql`
      SELECT 
        cp.id,
        cp.car_id,
        cp.rentprog_price_id,
        cp.season_id,
        cp.price_values,
        cp.created_at,
        c.rentprog_id as car_rentprog_id,
        c.plate as car_plate
      FROM car_prices cp
      JOIN cars c ON c.id = cp.car_id
      WHERE cp.created_at >= NOW() - INTERVAL '1 hour'
      ORDER BY cp.created_at DESC
      LIMIT 20
    `;
    
    console.log(`   Найдено цен за последний час: ${recentPrices.length}\n`);
    
    if (recentPrices.length > 0) {
      console.log('   Примеры сохраненных цен:');
      recentPrices.slice(0, 5).forEach((price, idx) => {
        console.log(`\n   ${idx + 1}. Цена ID: ${price.rentprog_price_id}`);
        console.log(`      Машина: ${price.car_plate || price.car_rentprog_id}`);
        console.log(`      Сезон: ${price.season_id}`);
        console.log(`      Сохранено: ${price.created_at}`);
        console.log(`      Цены: ${price.price_values ? 'есть' : 'нет'}`);
      });
    } else {
      console.log('   ⚠️  Цены за последний час не найдены');
    }
    
    // 2. Проверяем общее количество цен
    console.log('\n\n2️⃣ Общая статистика цен:\n');
    
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT car_id) as unique_cars,
        COUNT(DISTINCT season_id) as unique_seasons,
        MIN(created_at) as oldest,
        MAX(created_at) as newest
      FROM car_prices
    `;
    
    const stat = stats[0];
    console.log(`   Всего цен: ${stat.total}`);
    console.log(`   Уникальных машин: ${stat.unique_cars}`);
    console.log(`   Уникальных сезонов: ${stat.unique_seasons}`);
    console.log(`   Самая старая: ${stat.oldest}`);
    console.log(`   Самая новая: ${stat.newest}`);
    
    // 3. Проверяем машины без цен
    console.log('\n\n3️⃣ Машины без цен:\n');
    
    const carsWithoutPrices = await sql`
      SELECT 
        c.id,
        c.rentprog_id,
        c.plate,
        c.model,
        COUNT(cp.id) as price_count
      FROM cars c
      LEFT JOIN car_prices cp ON cp.car_id = c.id
      WHERE c.rentprog_id IS NOT NULL
      GROUP BY c.id, c.rentprog_id, c.plate, c.model
      HAVING COUNT(cp.id) = 0
      LIMIT 10
    `;
    
    console.log(`   Машин без цен: ${carsWithoutPrices.length}`);
    if (carsWithoutPrices.length > 0) {
      console.log('\n   Примеры:');
      carsWithoutPrices.slice(0, 5).forEach((car, idx) => {
        console.log(`   ${idx + 1}. ${car.plate || car.model || 'ID: ' + car.rentprog_id}`);
      });
    }
    
    // 4. Проверяем последние машины из парсинга
    console.log('\n\n4️⃣ Последние машины из парсинга:\n');
    
    const recentCars = await sql`
      SELECT 
        c.id,
        c.rentprog_id,
        c.plate,
        c.model,
        c.updated_at,
        COUNT(cp.id) as price_count
      FROM cars c
      LEFT JOIN car_prices cp ON cp.car_id = c.id
      WHERE c.updated_at >= NOW() - INTERVAL '1 hour'
        AND c.rentprog_id IS NOT NULL
      GROUP BY c.id, c.rentprog_id, c.plate, c.model, c.updated_at
      ORDER BY c.updated_at DESC
      LIMIT 10
    `;
    
    console.log(`   Машин обновлено за последний час: ${recentCars.length}\n`);
    
    if (recentCars.length > 0) {
      console.log('   Примеры:');
      recentCars.forEach((car, idx) => {
        console.log(`   ${idx + 1}. ${car.plate || car.model || 'ID: ' + car.rentprog_id}`);
        console.log(`      Обновлено: ${car.updated_at}`);
        console.log(`      Цен: ${car.price_count}`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await sql.end();
  }
}

checkPrices()
  .then(() => {
    console.log('\n✅ Проверка завершена');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка:', error.message);
    process.exit(1);
  });

