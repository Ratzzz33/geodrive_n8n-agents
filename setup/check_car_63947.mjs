import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkCar() {
  try {
    console.log('🔍 Проверка машины rentprog_id=63947, plate=RR635WR\n');

    // Ищем по rentprog_id через external_refs
    const carByRentprogId = await sql`
      SELECT 
        c.id,
        c.plate,
        c.model,
        c.company_id,
        c.branch_id,
        b.code as branch_code,
        c.created_at,
        c.updated_at,
        er.external_id as rentprog_id
      FROM external_refs er
      JOIN cars c ON c.id = er.entity_id
      JOIN branches b ON b.id = c.branch_id
      WHERE er.system = 'rentprog'
        AND er.external_id = '63947'
        AND er.entity_type = 'car'
    `;

    // Ищем по госномеру
    const carByPlate = await sql`
      SELECT 
        c.id,
        c.plate,
        c.model,
        c.company_id,
        c.branch_id,
        b.code as branch_code,
        c.created_at,
        c.updated_at,
        er.external_id as rentprog_id
      FROM cars c
      LEFT JOIN external_refs er ON er.entity_id = c.id 
        AND er.entity_type = 'car'
        AND er.system = 'rentprog'
      LEFT JOIN branches b ON b.id = c.branch_id
      WHERE UPPER(REPLACE(c.plate, ' ', '')) = UPPER(REPLACE('RR635WR', ' ', ''))
    `;

    console.log('📋 Поиск по rentprog_id=63947:');
    if (carByRentprogId.length > 0) {
      const car = carByRentprogId[0];
      console.log(`   ✅ Найдена машина:`);
      console.log(`      ID: ${car.id}`);
      console.log(`      Госномер: ${car.plate || 'NULL'}`);
      console.log(`      Модель: ${car.model || 'NULL'}`);
      console.log(`      RentProg ID: ${car.rentprog_id}`);
      console.log(`      Company ID: ${car.company_id || 'NULL'}`);
      console.log(`      Филиал: ${car.branch_code || 'NULL'}`);
      console.log(`      Создана: ${car.created_at}`);
      console.log(`      Обновлена: ${car.updated_at}`);
    } else {
      console.log('   ❌ Машина с rentprog_id=63947 НЕ найдена в БД');
    }

    console.log('\n📋 Поиск по госномеру RR635WR:');
    if (carByPlate.length > 0) {
      const car = carByPlate[0];
      console.log(`   ✅ Найдена машина:`);
      console.log(`      ID: ${car.id}`);
      console.log(`      Госномер: ${car.plate || 'NULL'}`);
      console.log(`      Модель: ${car.model || 'NULL'}`);
      console.log(`      RentProg ID: ${car.rentprog_id || 'NULL'}`);
      console.log(`      Company ID: ${car.company_id || 'NULL'}`);
      console.log(`      Филиал: ${car.branch_code || 'NULL'}`);
      console.log(`      Создана: ${car.created_at}`);
      console.log(`      Обновлена: ${car.updated_at}`);
    } else {
      console.log('   ❌ Машина с госномером RR635WR НЕ найдена в БД');
    }

    // Проверяем, есть ли запись в snapshot
    const snapshot = await sql`
      SELECT 
        rentprog_id,
        plate,
        model,
        company_id,
        fetched_at
      FROM rentprog_car_states_snapshot
      WHERE rentprog_id = '63947'
    `;

    console.log('\n📋 Данные в snapshot (rentprog_car_states_snapshot):');
    if (snapshot.length > 0) {
      const snap = snapshot[0];
      console.log(`   ✅ Найдена запись:`);
      console.log(`      RentProg ID: ${snap.rentprog_id}`);
      console.log(`      Госномер: ${snap.plate || 'NULL'}`);
      console.log(`      Модель: ${snap.model || 'NULL'}`);
      console.log(`      Company ID: ${snap.company_id || 'NULL'}`);
      console.log(`      Получено: ${snap.fetched_at}`);
    } else {
      console.log('   ❌ Запись в snapshot НЕ найдена');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
}

checkCar();

