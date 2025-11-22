import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkPriceChange() {
  try {
    const rentprogId = '39736';
    const targetDate = '2025-01-20'; // 20-е число
    const morningStart = `${targetDate} 06:00:00+04:00`; // 6:00 утра (Asia/Tbilisi)
    const morningEnd = `${targetDate} 12:00:00+04:00`; // 12:00 дня

    console.log(`🔍 Проверка изменения цены для авто rentprog_id=${rentprogId} утром ${targetDate}\n`);

    // 1. Находим автомобиль через external_refs
    const carInfo = await sql`
      SELECT 
        c.id as car_id,
        c.plate,
        c.model,
        c.price_hour as current_price_hour,
        c.updated_at as car_updated_at,
        b.code as branch_code,
        er.external_id as rentprog_id
      FROM external_refs er
      JOIN cars c ON c.id = er.entity_id
      LEFT JOIN branches b ON b.id = c.branch_id
      WHERE er.system = 'rentprog'
        AND er.entity_type = 'car'
        AND er.external_id = ${rentprogId}
    `;

    if (carInfo.length === 0) {
      console.log('❌ Автомобиль с rentprog_id=39736 не найден в БД');
      return;
    }

    const car = carInfo[0];
    console.log('📋 Информация об автомобиле:');
    console.log(`   ID: ${car.car_id}`);
    console.log(`   Номер: ${car.plate || 'не указан'}`);
    console.log(`   Модель: ${car.model || 'не указана'}`);
    console.log(`   Филиал: ${car.branch_code || 'не указан'}`);
    console.log(`   Текущая цена за час: ${car.current_price_hour || 'не указана'}`);
    console.log(`   Последнее обновление: ${car.car_updated_at || 'не указано'}`);
    console.log('');

    // 2. Проверяем снимки состояний утром 20-го
    console.log('📸 Проверка снимков состояний (rentprog_car_states_snapshot):');
    const snapshots = await sql`
      SELECT 
        rentprog_id,
        price_hour,
        fetched_at,
        car_name,
        plate,
        model
      FROM rentprog_car_states_snapshot
      WHERE rentprog_id = ${rentprogId}
        AND fetched_at >= ${morningStart}::timestamptz
        AND fetched_at <= ${morningEnd}::timestamptz
      ORDER BY fetched_at ASC
    `;

    if (snapshots.length === 0) {
      console.log('   ⚠️  Снимков утром 20-го не найдено');
    } else {
      console.log(`   ✅ Найдено ${snapshots.length} снимков:`);
      snapshots.forEach((snap, idx) => {
        console.log(`   ${idx + 1}. ${snap.fetched_at.toISOString()}`);
        console.log(`      Цена за час: ${snap.price_hour || 'не указана'}`);
        console.log(`      Машина: ${snap.car_name || snap.model || 'не указана'} (${snap.plate || 'нет номера'})`);
      });

      // Проверяем изменения цены между снимками
      if (snapshots.length > 1) {
        console.log('\n   🔄 Изменения цены между снимками:');
        for (let i = 1; i < snapshots.length; i++) {
          const prev = snapshots[i - 1];
          const curr = snapshots[i];
          if (prev.price_hour !== curr.price_hour) {
            console.log(`   ⚠️  ИЗМЕНЕНИЕ ЦЕНЫ обнаружено!`);
            console.log(`      ${prev.fetched_at.toISOString()}: ${prev.price_hour || 'не указана'}`);
            console.log(`      ${curr.fetched_at.toISOString()}: ${curr.price_hour || 'не указана'}`);
          }
        }
      }
    }
    console.log('');

    // 3. Проверяем изменения цен в таблице car_prices
    console.log('💰 Проверка истории цен (car_prices):');
    const priceHistory = await sql`
      SELECT 
        id,
        car_id,
        season_name,
        price_values,
        updated_at,
        created_at
      FROM car_prices
      WHERE car_id = ${car.car_id}
        AND (updated_at >= ${morningStart}::timestamptz 
             OR created_at >= ${morningStart}::timestamptz)
        AND (updated_at <= ${morningEnd}::timestamptz 
             OR created_at <= ${morningEnd}::timestamptz)
      ORDER BY updated_at ASC, created_at ASC
    `;

    if (priceHistory.length === 0) {
      console.log('   ⚠️  Изменений цен в car_prices утром 20-го не найдено');
    } else {
      console.log(`   ✅ Найдено ${priceHistory.length} записей:`);
      priceHistory.forEach((price, idx) => {
        console.log(`   ${idx + 1}. Сезон: ${price.season_name || 'не указан'}`);
        console.log(`      Создано: ${price.created_at.toISOString()}`);
        console.log(`      Обновлено: ${price.updated_at.toISOString()}`);
        if (price.price_values) {
          const pv = typeof price.price_values === 'string' 
            ? JSON.parse(price.price_values) 
            : price.price_values;
          if (pv.items && Array.isArray(pv.items)) {
            console.log(`      Цены: ${pv.items.map(i => `${i.period}: ${i.price_per_day || i.price_gel || 'N/A'}`).join(', ')}`);
          }
        }
      });
    }
    console.log('');

    // 4. Проверяем все снимки за 20-е число (для контекста)
    console.log('📊 Все снимки за 20-е число (для контекста):');
    const allSnapshots20 = await sql`
      SELECT 
        rentprog_id,
        price_hour,
        fetched_at
      FROM rentprog_car_states_snapshot
      WHERE rentprog_id = ${rentprogId}
        AND fetched_at >= ${targetDate}::date
        AND fetched_at < (${targetDate}::date + INTERVAL '1 day')
      ORDER BY fetched_at ASC
    `;

    if (allSnapshots20.length === 0) {
      console.log('   ⚠️  Снимков за 20-е число не найдено');
    } else {
      console.log(`   ✅ Найдено ${allSnapshots20.length} снимков за весь день:`);
      allSnapshots20.forEach((snap, idx) => {
        const isMorning = snap.fetched_at >= new Date(morningStart) && snap.fetched_at <= new Date(morningEnd);
        const marker = isMorning ? '🌅' : '   ';
        console.log(`   ${marker} ${idx + 1}. ${snap.fetched_at.toISOString()} - цена: ${snap.price_hour || 'не указана'}`);
      });
    }
    console.log('');

    // 5. Итоговый вывод
    console.log('📝 ИТОГ:');
    const hasMorningChanges = snapshots.length > 0 && snapshots.some((s, i, arr) => 
      i > 0 && arr[i-1].price_hour !== s.price_hour
    );
    const hasPriceHistory = priceHistory.length > 0;

    if (hasMorningChanges || hasPriceHistory) {
      console.log('   ✅ Обнаружены изменения цены утром 20-го!');
      if (hasMorningChanges) {
        console.log('      - Изменения в снимках состояний (rentprog_car_states_snapshot)');
      }
      if (hasPriceHistory) {
        console.log('      - Изменения в истории цен (car_prices)');
      }
    } else {
      console.log('   ❌ Изменений цены утром 20-го не обнаружено');
      if (snapshots.length === 0) {
        console.log('      - Снимков утром 20-го не было');
      } else {
        console.log('      - Цена в снимках не менялась');
      }
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
  } finally {
    await sql.end();
  }
}

checkPriceChange();

