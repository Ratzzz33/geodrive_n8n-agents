import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkBookingsDataStructure() {
  try {
    console.log('='.repeat(80));
    console.log('ПРОВЕРКА: Структура data в bookings');
    console.log('='.repeat(80));
    
    // Примеры данных из поля data
    console.log('\n--- Примеры поля data (первые 5 записей) ---\n');
    
    const examples = await sql`
      SELECT 
        id,
        state,
        status,
        data,
        car as car_jsonb,
        car_code,
        car_name
      FROM bookings
      WHERE data IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 5
    `;
    
    examples.forEach((row, idx) => {
      console.log(`\n=== Запись ${idx + 1} ===`);
      console.log(`ID: ${row.id}`);
      console.log(`State: ${row.state}`);
      console.log(`Status: ${row.status}`);
      console.log(`car_code: ${row.car_code}`);
      console.log(`car_name: ${row.car_name}`);
      
      if (row.data) {
        console.log(`\ndata (JSON):`);
        console.log(JSON.stringify(row.data, null, 2));
      }
      
      if (row.car_jsonb) {
        console.log(`\ncar (JSON):`);
        console.log(JSON.stringify(row.car_jsonb, null, 2));
      }
    });
    
    // Проверка, есть ли car_id в data
    console.log('\n' + '='.repeat(80));
    console.log('ПРОВЕРКА: Есть ли car_id в поле data?');
    console.log('='.repeat(80));
    
    const withCarId = await sql`
      SELECT COUNT(*) as count
      FROM bookings
      WHERE data->>'car_id' IS NOT NULL
    `;
    
    console.log(`\nЗаписей с data->>'car_id': ${withCarId[0].count}`);
    
    if (parseInt(withCarId[0].count) > 0) {
      console.log('\n✅ Поле car_id ЕСТЬ в data! Показываю примеры...\n');
      
      const carIdExamples = await sql`
        SELECT 
          id,
          state,
          data->>'car_id' as rentprog_car_id,
          car_code,
          car_name
        FROM bookings
        WHERE data->>'car_id' IS NOT NULL
        LIMIT 10
      `;
      
      console.log('| booking_id | state | rentprog_car_id | car_code | car_name |');
      console.log('|------------|-------|-----------------|----------|----------|');
      carIdExamples.forEach(row => {
        console.log(`| ${row.id.substring(0, 8)}... | ${row.state} | ${row.rentprog_car_id} | ${row.car_code || 'N/A'} | ${row.car_name || 'N/A'} |`);
      });
    }
    
    // Проверка external_refs
    console.log('\n' + '='.repeat(80));
    console.log('ПРОВЕРКА: Автомобили в external_refs');
    console.log('='.repeat(80));
    
    const extRefs = await sql`
      SELECT 
        entity_id,
        external_id,
        system
      FROM external_refs
      WHERE entity_type = 'car'
        AND system = 'rentprog'
      LIMIT 10
    `;
    
    console.log(`\nАвтомобилей в external_refs: ${extRefs.length}\n`);
    console.log('| entity_id (UUID) | rentprog_id | system |');
    console.log('|------------------|-------------|--------|');
    extRefs.forEach(ref => {
      console.log(`| ${ref.entity_id} | ${ref.external_id} | ${ref.system} |`);
    });
    
    // Тестовый JOIN
    console.log('\n' + '='.repeat(80));
    console.log('ТЕСТ: Можем ли связать bookings с cars через external_refs?');
    console.log('='.repeat(80));
    
    const testJoin = await sql`
      SELECT 
        b.id as booking_id,
        b.state,
        b.data->>'car_id' as rentprog_car_id,
        er.entity_id as cars_uuid,
        c.plate,
        c.model
      FROM bookings b
      INNER JOIN external_refs er 
        ON er.external_id = b.data->>'car_id'
        AND er.entity_type = 'car'
        AND er.system = 'rentprog'
      INNER JOIN cars c ON c.id = er.entity_id
      WHERE b.data->>'car_id' IS NOT NULL
      LIMIT 10
    `;
    
    console.log(`\nУспешно связанных записей: ${testJoin.length}\n`);
    
    if (testJoin.length > 0) {
      console.log('✅ СВЯЗЬ РАБОТАЕТ! Примеры:\n');
      console.log('| booking_id | state | rentprog_id | plate | model |');
      console.log('|------------|-------|-------------|-------|-------|');
      testJoin.forEach(row => {
        console.log(`| ${row.booking_id.substring(0, 8)}... | ${row.state} | ${row.rentprog_car_id} | ${row.plate} | ${row.model} |`);
      });
    } else {
      console.log('⚠️ Нет совпадений - нужно проверить данные');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Проверка завершена');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Ошибка при проверке:', error.message);
    console.error(error);
  } finally {
    await sql.end();
  }
}

checkBookingsDataStructure();

