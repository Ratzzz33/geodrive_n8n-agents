import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function findCarByPlate() {
  try {
    console.log('🔍 Поиск машины по номеру RR635WR...\n');

    // Ищем машину по номеру (с учетом разных форматов)
    const cars = await sql`
      SELECT 
        c.id,
        c.plate,
        c.car_visual_name,
        c.model,
        c.branch_id,
        er.external_id as rentprog_id,
        er.system
      FROM cars c
      LEFT JOIN external_refs er ON er.entity_id = c.id 
        AND er.entity_type = 'car'
        AND er.system = 'rentprog'
      WHERE UPPER(REPLACE(c.plate, ' ', '')) = UPPER(REPLACE('RR635WR', ' ', ''))
         OR UPPER(REPLACE(c.plate, ' ', '')) LIKE '%635%'
    `;

    if (cars.length === 0) {
      console.log('❌ Машина с номером RR635WR не найдена в БД');
      console.log('\n💡 Варианты:');
      console.log('   1. Машина еще не синхронизирована из RentProg');
      console.log('   2. Номер записан в другом формате');
      console.log('   3. Нужно создать запись вручную или синхронизировать из RentProg');
      return;
    }

    console.log(`✅ Найдено машин: ${cars.length}\n`);

    for (const car of cars) {
      console.log(`📋 Машина:`);
      console.log(`   ID: ${car.id}`);
      console.log(`   Название: ${car.car_visual_name || ''} ${car.model}`);
      console.log(`   Номер: ${car.plate}`);
      if (car.rentprog_id) {
        console.log(`   RentProg ID: ${car.rentprog_id}`);
      } else {
        console.log(`   RentProg ID: не найден в external_refs`);
      }
      console.log(`   Филиал: ${car.branch_id || 'не указан'}`);
      console.log('');

      // Проверяем, есть ли у машины трекер
      const tracker = await sql`
        SELECT 
          id,
          device_id,
          alias,
          matched
        FROM starline_devices
        WHERE car_id = ${car.id}
          AND matched = TRUE
      `;

      if (tracker.length > 0) {
        console.log(`   ⚠️  У машины уже есть трекер: ${tracker[0].alias}`);
      } else {
        console.log(`   ✅ У машины нет трекера - можно сопоставить`);
      }
      console.log('');
    }

    // Если найдена одна машина и у неё нет трекера - предлагаем сопоставить
    if (cars.length === 1 && !cars[0].rentprog_id) {
      console.log('💡 Машина найдена, но нет RentProg ID в external_refs');
      console.log('   Можно добавить external_ref для RentProg ID 63947');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Запускаем
findCarByPlate();

