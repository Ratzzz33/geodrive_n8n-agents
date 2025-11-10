import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkCars() {
  try {
    console.log('🔍 Проверка машин из уведомления\n');

    const plates = ['AP589AA', 'RL630RL', 'UU630UL', 'JQ680QQ'];

    for (const plate of plates) {
      console.log(`\n📋 Проверка: ${plate}`);
      console.log('━'.repeat(50));

      // Ищем в БД по plate
      const dbCar = await sql`
        SELECT 
          c.id,
          c.plate,
          c.model,
          c.state,
          c.company_id,
          er.external_id as rentprog_id,
          b.code as branch_code
        FROM cars c
        LEFT JOIN external_refs er ON er.entity_id = c.id
          AND er.system = 'rentprog'
          AND er.entity_type = 'car'
        LEFT JOIN branches b ON b.id = c.branch_id
        WHERE c.plate = ${plate}
        LIMIT 1
      `;

      if (dbCar.length > 0) {
        const car = dbCar[0];
        console.log(`   ✅ НАЙДЕНА в БД:`);
        console.log(`      ID: ${car.id}`);
        console.log(`      RentProg ID: ${car.rentprog_id || 'НЕТ'}`);
        console.log(`      Модель: ${car.model}`);
        console.log(`      State: ${car.state}`);
        console.log(`      Company ID: ${car.company_id}`);
        console.log(`      Branch: ${car.branch_code}`);

        // Проверяем external_refs
        if (!car.rentprog_id) {
          console.log(`      ⚠️  НЕТ связи с RentProg в external_refs!`);
        }
      } else {
        console.log(`   ❌ НЕ НАЙДЕНА в БД по plate: ${plate}`);
      }

      // Ищем по RentProg ID (если знаем)
      // Но мы не знаем RentProg ID из уведомления, поэтому ищем по plate
    }

    // Проверяем, есть ли машины с этими номерами, но без external_refs
    console.log('\n\n🔍 Проверка машин без external_refs:');
    console.log('━'.repeat(50));

    const carsWithoutRefs = await sql`
      SELECT 
        c.id,
        c.plate,
        c.model,
        c.state,
        c.company_id
      FROM cars c
      WHERE c.plate IN (${sql(plates)})
        AND NOT EXISTS (
          SELECT 1 FROM external_refs er
          WHERE er.entity_id = c.id
            AND er.system = 'rentprog'
            AND er.entity_type = 'car'
        )
    `;

    if (carsWithoutRefs.length > 0) {
      console.log(`   Найдено машин без external_refs: ${carsWithoutRefs.length}`);
      for (const car of carsWithoutRefs) {
        console.log(`\n   🚗 ${car.plate} (${car.model})`);
        console.log(`      ID: ${car.id}`);
        console.log(`      State: ${car.state}`);
        console.log(`      Company ID: ${car.company_id}`);
        console.log(`      ⚠️  НЕТ связи с RentProg!`);
      }
    } else {
      console.log('   ✅ Все машины имеют external_refs');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
}

checkCars();

