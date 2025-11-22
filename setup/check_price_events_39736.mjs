import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkPriceEvents() {
  try {
    const rentprogId = '39736';

    console.log(`🔍 Проверка событий и изменений для авто rentprog_id=${rentprogId}\n`);

    // 1. Находим автомобиль
    const carInfo = await sql`
      SELECT 
        c.id as car_id,
        c.plate,
        c.model,
        c.price_hour,
        c.updated_at,
        er.external_id as rentprog_id
      FROM external_refs er
      JOIN cars c ON c.id = er.entity_id
      WHERE er.system = 'rentprog'
        AND er.entity_type = 'car'
        AND er.external_id = ${rentprogId}
    `;

    if (carInfo.length === 0) {
      console.log('❌ Автомобиль не найден');
      return;
    }

    const car = carInfo[0];
    console.log('📋 Автомобиль:');
    console.log(`   ID: ${car.car_id}`);
    console.log(`   Номер: ${car.plate || 'не указан'}`);
    console.log(`   Модель: ${car.model || 'не указана'}`);
    console.log(`   Текущая цена: ${car.price_hour || 'не указана'}`);
    console.log(`   Обновлено: ${car.updated_at || 'не указано'}`);
    console.log('');

    // 2. Проверяем события связанные с автомобилем (car.*)
    console.log('📨 События связанные с автомобилем (car.*):');
    const carEvents = await sql`
      SELECT 
        type,
        ts,
        company_id,
        ext_id,
        rentprog_id,
        ok,
        reason
      FROM events
      WHERE (ext_id = ${rentprogId} OR rentprog_id = ${rentprogId})
        AND (type LIKE 'car.%' OR entity_type = 'car')
      ORDER BY ts DESC
      LIMIT 20
    `;

    if (carEvents.length === 0) {
      console.log('   ⚠️  Событий не найдено');
    } else {
      console.log(`   ✅ Найдено ${carEvents.length} событий:`);
      carEvents.forEach((evt, idx) => {
        const date = evt.ts.toISOString().split('T')[0];
        const time = evt.ts.toISOString().split('T')[1].split('.')[0];
        console.log(`   ${idx + 1}. ${date} ${time} - ${evt.type || 'не указан'} (company_id: ${evt.company_id || 'не указан'})`);
      });
    }
    console.log('');

    // 3. Проверяем все события на 20-е число разных месяцев
    console.log('📅 События на 20-е число разных месяцев:');
    const twentiethEvents = await sql`
      SELECT 
        type,
        ts,
        company_id,
        ext_id,
        rentprog_id,
        ok
      FROM events
      WHERE (ext_id = ${rentprogId} OR rentprog_id = ${rentprogId})
        AND EXTRACT(DAY FROM ts) = 20
      ORDER BY ts DESC
      LIMIT 20
    `;

    if (twentiethEvents.length === 0) {
      console.log('   ⚠️  Событий на 20-е число не найдено');
    } else {
      console.log(`   ✅ Найдено ${twentiethEvents.length} событий:`);
      twentiethEvents.forEach((evt, idx) => {
        const date = evt.ts.toISOString().split('T')[0];
        const time = evt.ts.toISOString().split('T')[1].split('.')[0];
        console.log(`   ${idx + 1}. ${date} ${time} - ${evt.type || 'не указан'} (company_id: ${evt.company_id || 'не указан'})`);
      });
    }
    console.log('');

    // 4. Проверяем изменения в таблице cars (updated_at на 20-е число)
    console.log('🔄 Изменения в таблице cars на 20-е число:');
    const carUpdates = await sql`
      SELECT 
        id,
        plate,
        model,
        price_hour,
        updated_at
      FROM cars
      WHERE id = ${car.car_id}
        AND EXTRACT(DAY FROM updated_at) = 20
      ORDER BY updated_at DESC
    `;

    if (carUpdates.length === 0) {
      console.log('   ⚠️  Обновлений на 20-е число не найдено');
    } else {
      console.log(`   ✅ Найдено обновлений:`);
      carUpdates.forEach((upd, idx) => {
        const date = upd.updated_at.toISOString().split('T')[0];
        const time = upd.updated_at.toISOString().split('T')[1].split('.')[0];
        console.log(`   ${idx + 1}. ${date} ${time} - цена: ${upd.price_hour || 'не указана'}`);
      });
    }
    console.log('');

    // 5. Проверяем все обновления cars за последний месяц
    console.log('📊 Все обновления cars за последний месяц:');
    const recentUpdates = await sql`
      SELECT 
        updated_at,
        price_hour
      FROM cars
      WHERE id = ${car.car_id}
        AND updated_at >= NOW() - INTERVAL '30 days'
      ORDER BY updated_at DESC
    `;

    if (recentUpdates.length === 0) {
      console.log('   ⚠️  Обновлений за последний месяц не найдено');
    } else {
      console.log(`   ✅ Найдено ${recentUpdates.length} обновлений:`);
      recentUpdates.forEach((upd, idx) => {
        const date = upd.updated_at.toISOString().split('T')[0];
        const time = upd.updated_at.toISOString().split('T')[1].split('.')[0];
        console.log(`   ${idx + 1}. ${date} ${time} - цена: ${upd.price_hour || 'не указана'}`);
      });
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
  } finally {
    await sql.end();
  }
}

checkPriceEvents();

