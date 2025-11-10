import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkCompareLogic() {
  try {
    console.log('🔍 Проверка логики сравнения\n');

    const plates = ['AP589AA', 'RL630RL', 'UU630UL', 'JQ680QQ'];

    // Получаем данные из БД так же, как в узле "Get Cars from DB"
    const dbCars = await sql`
      SELECT
        c.id AS car_db_id,
        c.branch_id AS branch_id,
        er.external_id::text AS rentprog_id,
        c.company_id::text AS company_id,
        c.model AS model,
        c.plate AS plate,
        c.state AS state,
        c.transmission AS transmission,
        c.year AS year,
        c.number_doors AS number_doors,
        c.number_seats AS number_seats,
        c.is_air AS is_air,
        c.engine_capacity AS engine_capacity,
        c.engine_power AS engine_power,
        c.trunk_volume AS trunk_volume,
        c.avatar_url AS avatar_url,
        b.code AS branch_code
      FROM cars c
      JOIN external_refs er ON er.entity_id = c.id
      JOIN branches b ON b.id = c.branch_id
      WHERE er.system = 'rentprog'
        AND er.entity_type = 'car'
        AND c.plate IN (${sql(plates)})
    `;

    console.log(`📊 Найдено машин в БД: ${dbCars.length}`);
    for (const car of dbCars) {
      console.log(`\n   🚗 ${car.plate} (${car.model})`);
      console.log(`      RentProg ID: ${car.rentprog_id}`);
      console.log(`      DB ID: ${car.car_db_id}`);
      console.log(`      State: ${car.state}`);
      console.log(`      Company ID: ${car.company_id}`);
      
      // Проверяем, как будет искаться в Map
      const rentprogIdStr = String(car.rentprog_id);
      console.log(`      Ключ для Map: "${rentprogIdStr}" (тип: ${typeof rentprogIdStr})`);
    }

    // Симулируем логику из "Compare API vs DB"
    console.log('\n\n🔍 Симуляция логики сравнения:');
    console.log('━'.repeat(50));

    // Создаем Map как в коде
    const dbMap = new Map();
    dbCars.forEach(car => {
      if (car && car.rentprog_id) {
        const key = String(car.rentprog_id);
        dbMap.set(key, car);
        console.log(`   ✅ Добавлено в Map: key="${key}", plate=${car.plate}`);
      } else {
        console.log(`   ❌ НЕ добавлено в Map: rentprog_id=${car.rentprog_id}`);
      }
    });

    console.log(`\n   Размер Map: ${dbMap.size}`);

    // Проверяем поиск по разным форматам ID
    const testIds = ['64840', 64840, '42291', 42291, '38191', 38191, '37399', 37399];
    console.log('\n   Тест поиска в Map:');
    for (const testId of testIds) {
      const key = String(testId);
      const found = dbMap.get(key);
      if (found) {
        console.log(`   ✅ Найдено: key="${key}" → plate=${found.plate}`);
      } else {
        console.log(`   ❌ НЕ найдено: key="${key}"`);
      }
    }

    // Проверяем все ключи в Map
    console.log('\n   Все ключи в Map:');
    for (const key of dbMap.keys()) {
      console.log(`      - "${key}" (тип: ${typeof key})`);
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
  } finally {
    await sql.end();
  }
}

checkCompareLogic();

