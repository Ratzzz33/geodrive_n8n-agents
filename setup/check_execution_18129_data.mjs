import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkExecutionData() {
  try {
    console.log('🔍 Проверка данных из execution #18129...\n');

    // Получаем все машины из Kutaisi, сохраненные недавно (после 18:16 UTC)
    const snapshotCars = await sql`
      SELECT 
        rentprog_id,
        car_name,
        code,
        number,
        vin,
        branch_id,
        fetched_at
      FROM rentprog_car_states_snapshot
      WHERE branch_id = '5e551b32-934c-498f-a4a1-a90079985c0a'
        AND fetched_at >= '2025-11-17 18:16:00'::timestamptz
      ORDER BY fetched_at DESC, rentprog_id
    `;

    console.log(`📊 Записей в rentprog_car_states_snapshot: ${snapshotCars.length}`);
    console.log('\nСписок машин:');
    snapshotCars.forEach((car, idx) => {
      console.log(`${idx + 1}. ${car.car_name} (${car.code}) - rentprog_id: ${car.rentprog_id}, number: ${car.number}`);
    });

    // Проверяем в основной таблице cars
    const carsFromDB = await sql`
      SELECT 
        rentprog_id,
        car_name,
        code,
        number,
        vin,
        branch_id,
        updated_at
      FROM cars
      WHERE branch_id = '5e551b32-934c-498f-a4a1-a90079985c0a'
        AND updated_at >= '2025-11-17 18:16:00'::timestamptz
      ORDER BY updated_at DESC, rentprog_id
    `;

    console.log(`\n📊 Записей в cars: ${carsFromDB.length}`);
    console.log('\nСписок машин в cars:');
    carsFromDB.forEach((car, idx) => {
      console.log(`${idx + 1}. ${car.car_name} (${car.code}) - rentprog_id: ${car.rentprog_id}, number: ${car.number}`);
    });

    // Проверяем конкретные rentprog_id из execution
    const expectedIds = ['38191', '50169', '38192', '38193', '38194', '38195', '38196', '38197', '38198', '38199', '38200'];
    
    console.log('\n🔍 Проверка конкретных rentprog_id из execution:');
    for (const id of expectedIds) {
      const inSnapshot = snapshotCars.some(c => c.rentprog_id === id);
      const inCars = carsFromDB.some(c => c.rentprog_id === id);
      const status = inSnapshot && inCars ? '✅' : inSnapshot ? '⚠️ только в snapshot' : inCars ? '⚠️ только в cars' : '❌ НЕ НАЙДЕНО';
      console.log(`  ${id}: ${status}`);
    }

    // Проверяем, что все поля заполнены для первой машины
    if (snapshotCars.length > 0) {
      const firstCar = await sql`
        SELECT *
        FROM rentprog_car_states_snapshot
        WHERE rentprog_id = ${snapshotCars[0].rentprog_id}
        ORDER BY fetched_at DESC
        LIMIT 1
      `;

      console.log('\n📋 Проверка полноты данных для первой машины:');
      const car = firstCar[0];
      const fields = [
        'branch_id', 'rentprog_id', 'car_name', 'code', 'number', 'vin', 'color', 'year',
        'transmission', 'fuel', 'car_type', 'car_class', 'active', 'state', 'tank_state',
        'clean_state', 'mileage', 'tire_type', 'tire_size', 'deposit', 'price_hour',
        'hourly_deposit', 'monthly_deposit', 'investor_id', 'purchase_price', 'purchase_date',
        'age_limit', 'driver_year_limit', 'franchise', 'max_fine', 'repair_cost',
        'is_air', 'climate_control', 'parktronic', 'parktronic_camera', 'heated_seats',
        'audio_system', 'usb_system', 'rain_sensor', 'engine_capacity', 'number_doors',
        'tank_value', 'pts', 'registration_certificate', 'body_number', 'data'
      ];

      const nullFields = [];
      const filledFields = [];
      
      fields.forEach(field => {
        if (car[field] === null || car[field] === undefined) {
          nullFields.push(field);
        } else {
          filledFields.push(field);
        }
      });

      console.log(`  ✅ Заполнено полей: ${filledFields.length}/${fields.length}`);
      if (nullFields.length > 0) {
        console.log(`  ⚠️ Пустые поля: ${nullFields.join(', ')}`);
      }
      console.log(`  📦 Поле data (JSONB): ${car.data ? '✅ заполнено' : '❌ пусто'}`);
    }

    console.log('\n✅ Проверка завершена');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error);
  } finally {
    await sql.end();
  }
}

checkExecutionData();

