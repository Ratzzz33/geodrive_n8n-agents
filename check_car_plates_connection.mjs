import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkPlatesConnection() {
  try {
    console.log('🔍 Проверка связи между номерами DK700DK и OC700OC\n');
    console.log('━'.repeat(60));

    const plates = ['DK700DK', 'OC700OC'];

    // 1. Проверяем, есть ли записи с этими номерами в таблице cars
    console.log('\n📋 1. Поиск машин по номерам в таблице cars:');
    console.log('━'.repeat(60));

    for (const plate of plates) {
      const cars = await sql`
        SELECT 
          c.id,
          c.plate,
          c.model,
          c.vin,
          c.rentprog_id,
          c.branch_id,
          b.code as branch_code,
          c.created_at,
          c.updated_at,
          c.data
        FROM cars c
        LEFT JOIN branches b ON b.id = c.branch_id
        WHERE UPPER(REPLACE(c.plate, ' ', '')) = UPPER(REPLACE(${plate}, ' ', ''))
      `;

      if (cars.length > 0) {
        console.log(`\n✅ Номер ${plate}:`);
        for (const car of cars) {
          console.log(`   ID: ${car.id}`);
          console.log(`   Модель: ${car.model || 'N/A'}`);
          console.log(`   VIN: ${car.vin || 'N/A'}`);
          console.log(`   RentProg ID: ${car.rentprog_id || 'N/A'}`);
          console.log(`   Филиал: ${car.branch_code || 'N/A'}`);
          console.log(`   Создано: ${car.created_at}`);
          console.log(`   Обновлено: ${car.updated_at}`);
          
          // Проверяем external_refs
          const refs = await sql`
            SELECT 
              er.system,
              er.external_id,
              er.meta
            FROM external_refs er
            WHERE er.entity_type = 'car'
              AND er.entity_id = ${car.id}
          `;
          
          if (refs.length > 0) {
            console.log(`   External Refs:`);
            for (const ref of refs) {
              console.log(`      - ${ref.system}: ${ref.external_id}`);
              if (ref.meta) {
                console.log(`        Meta: ${JSON.stringify(ref.meta)}`);
              }
            }
          }
        }
      } else {
        console.log(`\n❌ Номер ${plate}: НЕ НАЙДЕН в таблице cars`);
      }
    }

    // 2. Проверяем, есть ли связь через external_refs (один rentprog_id)
    console.log('\n\n📋 2. Проверка связи через external_refs (один rentprog_id):');
    console.log('━'.repeat(60));

    const carsByRefs = await sql`
      SELECT 
        c1.id as car1_id,
        c1.plate as plate1,
        c1.model as model1,
        c2.id as car2_id,
        c2.plate as plate2,
        c2.model as model2,
        er1.external_id as rentprog_id
      FROM cars c1
      JOIN external_refs er1 ON er1.entity_id = c1.id
      JOIN external_refs er2 ON er2.external_id = er1.external_id
      JOIN cars c2 ON c2.id = er2.entity_id
      WHERE er1.system = 'rentprog'
        AND er1.entity_type = 'car'
        AND er2.system = 'rentprog'
        AND er2.entity_type = 'car'
        AND (UPPER(REPLACE(c1.plate, ' ', '')) = 'DK700DK' OR UPPER(REPLACE(c1.plate, ' ', '')) = 'OC700OC')
        AND (UPPER(REPLACE(c2.plate, ' ', '')) = 'DK700DK' OR UPPER(REPLACE(c2.plate, ' ', '')) = 'OC700OC')
        AND c1.id != c2.id
    `;

    if (carsByRefs.length > 0) {
      console.log('\n✅ НАЙДЕНА СВЯЗЬ через external_refs:');
      for (const link of carsByRefs) {
        console.log(`   ${link.plate1} (${link.model1}) ↔ ${link.plate2} (${link.model2})`);
        console.log(`   RentProg ID: ${link.rentprog_id}`);
        console.log(`   Car1 ID: ${link.car1_id}`);
        console.log(`   Car2 ID: ${link.car2_id}`);
      }
    } else {
      console.log('\n❌ Связь через external_refs НЕ НАЙДЕНА');
    }

    // 3. Проверяем, есть ли связь через VIN (один VIN)
    console.log('\n\n📋 3. Проверка связи через VIN:');
    console.log('━'.repeat(60));

    const carsByVIN = await sql`
      SELECT 
        c1.id as car1_id,
        c1.plate as plate1,
        c1.model as model1,
        c1.vin as vin1,
        c2.id as car2_id,
        c2.plate as plate2,
        c2.model as model2,
        c2.vin as vin2
      FROM cars c1
      JOIN cars c2 ON c2.vin = c1.vin
      WHERE c1.vin IS NOT NULL
        AND c1.vin != ''
        AND (UPPER(REPLACE(c1.plate, ' ', '')) = 'DK700DK' OR UPPER(REPLACE(c1.plate, ' ', '')) = 'OC700OC')
        AND (UPPER(REPLACE(c2.plate, ' ', '')) = 'DK700DK' OR UPPER(REPLACE(c2.plate, ' ', '')) = 'OC700OC')
        AND c1.id != c2.id
    `;

    if (carsByVIN.length > 0) {
      console.log('\n✅ НАЙДЕНА СВЯЗЬ через VIN:');
      for (const link of carsByVIN) {
        console.log(`   ${link.plate1} (${link.model1}) ↔ ${link.plate2} (${link.model2})`);
        console.log(`   VIN: ${link.vin1}`);
        console.log(`   Car1 ID: ${link.car1_id}`);
        console.log(`   Car2 ID: ${link.car2_id}`);
      }
    } else {
      console.log('\n❌ Связь через VIN НЕ НАЙДЕНА');
    }

    // 4. Проверяем, есть ли связь через модель и другие поля
    console.log('\n\n📋 4. Проверка связи через модель "Santafe Black":');
    console.log('━'.repeat(60));

    const carsByModel = await sql`
      SELECT 
        c.id,
        c.plate,
        c.model,
        c.vin,
        c.rentprog_id,
        b.code as branch_code
      FROM cars c
      LEFT JOIN branches b ON b.id = c.branch_id
      WHERE UPPER(REPLACE(c.model, ' ', '')) LIKE '%SANTAFE%BLACK%'
         OR UPPER(REPLACE(c.model, ' ', '')) LIKE '%BLACK%'
      ORDER BY c.plate
    `;

    if (carsByModel.length > 0) {
      console.log(`\n✅ Найдено машин с моделью "Santafe Black": ${carsByModel.length}`);
      for (const car of carsByModel) {
        console.log(`   - ${car.plate || 'N/A'}: ${car.model || 'N/A'} (${car.branch_code || 'N/A'})`);
        console.log(`     VIN: ${car.vin || 'N/A'}, RentProg ID: ${car.rentprog_id || 'N/A'}`);
      }
    } else {
      console.log('\n❌ Машины с моделью "Santafe Black" НЕ НАЙДЕНЫ');
    }

    // 5. Проверяем данные в JSON поле data
    console.log('\n\n📋 5. Проверка данных в JSON поле data:');
    console.log('━'.repeat(60));

    for (const plate of plates) {
      const cars = await sql`
        SELECT 
          c.id,
          c.plate,
          c.data
        FROM cars c
        WHERE UPPER(REPLACE(c.plate, ' ', '')) = UPPER(REPLACE(${plate}, ' ', ''))
          AND c.data IS NOT NULL
          AND c.data != '{}'::jsonb
      `;

      if (cars.length > 0) {
        for (const car of cars) {
          console.log(`\n📄 Номер ${plate} - данные из JSON:`);
          const data = car.data;
          if (data.number) {
            console.log(`   number (в JSON): ${data.number}`);
          }
          if (data.car_number) {
            console.log(`   car_number (в JSON): ${data.car_number}`);
          }
          if (data.car_name) {
            console.log(`   car_name: ${data.car_name}`);
          }
          if (data.id) {
            console.log(`   id (RentProg): ${data.id}`);
          }
        }
      }
    }

    console.log('\n\n✅ Проверка завершена\n');

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

checkPlatesConnection();

