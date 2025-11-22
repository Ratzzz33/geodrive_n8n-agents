import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkCarChangesWithSource() {
  try {
    const rentprogId = '39736';
    const targetDate = '2025-01-20';
    const morningStart = `${targetDate} 06:00:00+04:00`;
    const morningEnd = `${targetDate} 12:00:00+04:00`;

    console.log(`🔍 Проверка изменений с источником для авто rentprog_id=${rentprogId} утром ${targetDate}\n`);

    // Находим автомобиль
    const carInfo = await sql`
      SELECT 
        c.id as car_id,
        c.plate,
        c.model,
        c.price_hour,
        c.updated_at,
        c.updated_by_source,
        c.updated_by_workflow,
        c.updated_by_function,
        c.updated_by_execution_id,
        c.updated_by_user,
        c.updated_by_metadata,
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
    console.log('📋 Информация об автомобиле:');
    console.log(`   ID: ${car.car_id}`);
    console.log(`   Номер: ${car.plate || 'не указан'}`);
    console.log(`   Модель: ${car.model || 'не указана'}`);
    console.log(`   Текущая цена: ${car.price_hour || 'не указана'}`);
    console.log(`   Последнее обновление: ${car.updated_at || 'не указано'}`);
    console.log('');

    // Проверяем источник последнего изменения
    console.log('🔍 Источник последнего изменения:');
    if (car.updated_by_source) {
      console.log(`   ✅ Источник: ${car.updated_by_source}`);
      if (car.updated_by_workflow) {
        console.log(`   📋 Workflow: ${car.updated_by_workflow}`);
      }
      if (car.updated_by_function) {
        console.log(`   🔧 Функция: ${car.updated_by_function}`);
      }
      if (car.updated_by_execution_id) {
        console.log(`   🆔 Execution ID: ${car.updated_by_execution_id}`);
      }
      if (car.updated_by_user) {
        console.log(`   👤 Пользователь: ${car.updated_by_user}`);
      }
      if (car.updated_by_metadata) {
        const metadata = typeof car.updated_by_metadata === 'string' 
          ? JSON.parse(car.updated_by_metadata) 
          : car.updated_by_metadata;
        console.log(`   📦 Metadata: ${JSON.stringify(metadata, null, 2)}`);
      }
    } else {
      console.log('   ⚠️  Информация об источнике отсутствует (старая запись)');
    }
    console.log('');

    // Проверяем изменения утром 20-го (если есть история)
    console.log('📅 Проверка изменений утром 20-го:');
    const morningUpdate = car.updated_at && 
      new Date(car.updated_at) >= new Date(morningStart) && 
      new Date(car.updated_at) <= new Date(morningEnd);

    if (morningUpdate) {
      console.log('   ✅ Обновление было утром 20-го!');
      console.log(`   Время: ${car.updated_at}`);
      console.log(`   Источник: ${car.updated_by_source || 'не указан'}`);
    } else {
      console.log('   ⚠️  Обновлений утром 20-го не найдено');
      if (car.updated_at) {
        const date = new Date(car.updated_at);
        const day = date.getDate();
        const hour = date.getHours();
        console.log(`   Последнее обновление: ${date.toISOString()} (день ${day}, час ${hour})`);
      }
    }

    // Проверяем все изменения за последний месяц
    console.log('\n📊 Все изменения за последний месяц:');
    const allChanges = await sql`
      SELECT 
        updated_at,
        price_hour,
        updated_by_source,
        updated_by_workflow,
        updated_by_function,
        updated_by_execution_id
      FROM cars
      WHERE id = ${car.car_id}
        AND updated_at >= NOW() - INTERVAL '30 days'
      ORDER BY updated_at DESC
      LIMIT 10
    `;

    if (allChanges.length === 0) {
      console.log('   ⚠️  Изменений не найдено');
    } else {
      console.log(`   ✅ Найдено ${allChanges.length} изменений:`);
      allChanges.forEach((change, idx) => {
        const date = change.updated_at.toISOString().split('T')[0];
        const time = change.updated_at.toISOString().split('T')[1].split('.')[0];
        console.log(`   ${idx + 1}. ${date} ${time}`);
        console.log(`      Цена: ${change.price_hour || 'не указана'}`);
        console.log(`      Источник: ${change.updated_by_source || 'не указан'}`);
        if (change.updated_by_workflow) {
          console.log(`      Workflow: ${change.updated_by_workflow}`);
        }
        if (change.updated_by_function) {
          console.log(`      Функция: ${change.updated_by_function}`);
        }
        if (change.updated_by_execution_id) {
          console.log(`      Execution ID: ${change.updated_by_execution_id}`);
        }
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
  } finally {
    await sql.end();
  }
}

checkCarChangesWithSource();

