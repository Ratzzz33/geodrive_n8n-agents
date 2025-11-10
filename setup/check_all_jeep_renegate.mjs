import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkAllJeepRenegate() {
  try {
    console.log('🔍 Поиск всех машин Jeep Renegate/Renegate\n');

    // Ищем в cars
    const cars = await sql`
      SELECT 
        c.id,
        c.plate,
        c.model,
        c.company_id,
        b.code as branch_code,
        c.created_at,
        c.updated_at,
        er.external_id as rentprog_id
      FROM cars c
      LEFT JOIN external_refs er ON er.entity_id = c.id 
        AND er.entity_type = 'car'
        AND er.system = 'rentprog'
      LEFT JOIN branches b ON b.id = c.branch_id
      WHERE LOWER(c.model) LIKE '%jeep%renegat%'
         OR LOWER(c.model) LIKE '%renegat%'
    `;

    console.log('📋 Машины Jeep Renegate в таблице cars:');
    if (cars.length > 0) {
      for (const car of cars) {
        console.log(`\n   🚗 ID: ${car.id}`);
        console.log(`      Госномер: ${car.plate || 'NULL'}`);
        console.log(`      Модель: ${car.model || 'NULL'}`);
        console.log(`      RentProg ID: ${car.rentprog_id || 'NULL'}`);
        console.log(`      Company ID: ${car.company_id || 'NULL'}`);
        console.log(`      Филиал: ${car.branch_code || 'NULL'}`);
        console.log(`      Создана: ${car.created_at}`);
        console.log(`      Обновлена: ${car.updated_at}`);
      }
    } else {
      console.log('   ❌ Машины не найдены');
    }

    // Ищем в snapshot
    const snapshots = await sql`
      SELECT 
        rentprog_id,
        plate,
        model,
        company_id,
        fetched_at
      FROM rentprog_car_states_snapshot
      WHERE LOWER(model) LIKE '%jeep%renegat%'
         OR LOWER(model) LIKE '%renegat%'
      ORDER BY fetched_at DESC
    `;

    console.log('\n📋 Машины Jeep Renegate в snapshot:');
    if (snapshots.length > 0) {
      for (const snap of snapshots) {
        console.log(`\n   📸 RentProg ID: ${snap.rentprog_id}`);
        console.log(`      Госномер: ${snap.plate || 'NULL'}`);
        console.log(`      Модель: ${snap.model || 'NULL'}`);
        console.log(`      Company ID: ${snap.company_id || 'NULL'}`);
        console.log(`      Получено: ${snap.fetched_at}`);
      }
    } else {
      console.log('   ❌ Записи не найдены');
    }

    // Ищем конкретно RR635WR
    console.log('\n📋 Поиск госномера RR635WR во всех таблицах:');
    const plateSearch = await sql`
      SELECT 
        'cars' as source,
        c.id,
        c.plate,
        c.model,
        er.external_id as rentprog_id,
        c.created_at,
        c.updated_at
      FROM cars c
      LEFT JOIN external_refs er ON er.entity_id = c.id 
        AND er.entity_type = 'car'
        AND er.system = 'rentprog'
      WHERE UPPER(REPLACE(c.plate, ' ', '')) LIKE '%RR635WR%'
         OR UPPER(REPLACE(c.plate, ' ', '')) LIKE '%635%'
      
      UNION ALL
      
      SELECT 
        'snapshot' as source,
        NULL::uuid as id,
        plate,
        model,
        rentprog_id,
        fetched_at as created_at,
        fetched_at as updated_at
      FROM rentprog_car_states_snapshot
      WHERE UPPER(REPLACE(plate, ' ', '')) LIKE '%RR635WR%'
         OR UPPER(REPLACE(plate, ' ', '')) LIKE '%635%'
    `;

    if (plateSearch.length > 0) {
      for (const item of plateSearch) {
        console.log(`\n   ✅ Найдено в ${item.source}:`);
        console.log(`      ID: ${item.id || 'N/A'}`);
        console.log(`      Госномер: ${item.plate || 'NULL'}`);
        console.log(`      Модель: ${item.model || 'NULL'}`);
        console.log(`      RentProg ID: ${item.rentprog_id || 'NULL'}`);
        console.log(`      Создано/Обновлено: ${item.created_at}`);
      }
    } else {
      console.log('   ❌ Госномер RR635WR нигде не найден');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
}

checkAllJeepRenegate();

