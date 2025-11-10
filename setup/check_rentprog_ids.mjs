import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkRentProgIds() {
  try {
    console.log('🔍 Проверка RentProg ID для машин из уведомления\n');

    const plates = ['AP589AA', 'RL630RL', 'UU630UL', 'JQ680QQ'];

    // Получаем данные из БД
    for (const plate of plates) {
      const dbCar = await sql`
        SELECT
          c.id AS car_db_id,
          er.external_id::text AS rentprog_id,
          c.plate,
          c.model,
          c.state,
          c.company_id::text AS company_id
        FROM cars c
        JOIN external_refs er ON er.entity_id = c.id
        WHERE er.system = 'rentprog'
          AND er.entity_type = 'car'
          AND c.plate = ${plate}
        LIMIT 1
      `;

      if (dbCar.length > 0) {
        const car = dbCar[0];
        console.log(`\n🚗 ${car.plate} (${car.model})`);
        console.log(`   RentProg ID в БД: "${car.rentprog_id}" (тип: ${typeof car.rentprog_id})`);
        console.log(`   State в БД: ${car.state}`);
        console.log(`   Company ID в БД: ${car.company_id}`);
        
        // Проверяем, как будет искаться в Map
        const key = String(car.rentprog_id);
        console.log(`   Ключ для Map: "${key}"`);
        console.log(`   Проверка поиска:`);
        console.log(`     - dbMap.get("${key}") → должно найти`);
        console.log(`     - dbMap.get(${car.rentprog_id}) → НЕ найдет (число)`);
        console.log(`     - dbMap.get("${car.rentprog_id}") → должно найти`);
      }
    }

    // Проверяем все RentProg ID в БД для этих машин
    console.log('\n\n📊 Все RentProg ID в БД:');
    const allCars = await sql`
      SELECT
        c.plate,
        er.external_id::text AS rentprog_id
      FROM cars c
      JOIN external_refs er ON er.entity_id = c.id
      WHERE er.system = 'rentprog'
        AND er.entity_type = 'car'
        AND c.plate IN (${sql(plates)})
      ORDER BY c.plate
    `;

    console.log(`   Найдено: ${allCars.length} машин`);
    for (const car of allCars) {
      console.log(`   - ${car.plate}: RentProg ID = "${car.rentprog_id}"`);
    }

    console.log('\n\n💡 ВЫВОД:');
    console.log('   Если в API приходят машины с этими RentProg ID, они ДОЛЖНЫ находиться в БД.');
    console.log('   Проблема может быть в том, что:');
    console.log('   1. В API приходят другие RentProg ID');
    console.log('   2. Данные из "Get Cars from DB" не правильно обрабатываются');
    console.log('   3. Проблема с типами данных (число vs строка)');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
}

checkRentProgIds();

