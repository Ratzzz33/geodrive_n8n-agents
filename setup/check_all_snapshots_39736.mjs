import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkAllSnapshots() {
  try {
    const rentprogId = '39736';

    console.log(`🔍 Проверка всех снимков для авто rentprog_id=${rentprogId}\n`);

    // Получаем все снимки, отсортированные по дате
    const allSnapshots = await sql`
      SELECT 
        rentprog_id,
        price_hour,
        fetched_at,
        car_name,
        plate,
        model
      FROM rentprog_car_states_snapshot
      WHERE rentprog_id = ${rentprogId}
      ORDER BY fetched_at DESC
      LIMIT 50
    `;

    if (allSnapshots.length === 0) {
      console.log('❌ Снимков для этого автомобиля не найдено');
      return;
    }

    console.log(`✅ Найдено ${allSnapshots.length} снимков (последние 50):\n`);

    // Группируем по датам
    const byDate = {};
    allSnapshots.forEach(snap => {
      const date = snap.fetched_at.toISOString().split('T')[0];
      if (!byDate[date]) {
        byDate[date] = [];
      }
      byDate[date].push(snap);
    });

    // Выводим по датам
    const dates = Object.keys(byDate).sort().reverse();
    dates.forEach(date => {
      const snaps = byDate[date];
      console.log(`📅 ${date} (${snaps.length} снимков):`);
      snaps.forEach((snap, idx) => {
        const time = snap.fetched_at.toISOString().split('T')[1].split('.')[0];
        console.log(`   ${idx + 1}. ${time} - цена: ${snap.price_hour || 'не указана'}`);
      });
      console.log('');
    });

    // Проверяем изменения цены
    console.log('🔄 Изменения цены между снимками:');
    let priceChanges = 0;
    for (let i = 1; i < allSnapshots.length; i++) {
      const prev = allSnapshots[i];
      const curr = allSnapshots[i - 1]; // идем от новых к старым
      if (prev.price_hour !== curr.price_hour && prev.price_hour !== null && curr.price_hour !== null) {
        priceChanges++;
        const prevDate = prev.fetched_at.toISOString().split('T')[0];
        const currDate = curr.fetched_at.toISOString().split('T')[0];
        const prevTime = prev.fetched_at.toISOString().split('T')[1].split('.')[0];
        const currTime = curr.fetched_at.toISOString().split('T')[1].split('.')[0];
        console.log(`   ⚠️  ${prevDate} ${prevTime}: ${prev.price_hour} → ${currDate} ${currTime}: ${curr.price_hour}`);
      }
    }

    if (priceChanges === 0) {
      console.log('   ✅ Изменений цены не обнаружено');
    }

    // Проверяем конкретно 20-е число разных месяцев
    console.log('\n📊 Проверка 20-х чисел разных месяцев:');
    const twentiethDays = allSnapshots.filter(s => {
      const day = s.fetched_at.getDate();
      return day === 20;
    });

    if (twentiethDays.length === 0) {
      console.log('   ⚠️  Снимков на 20-е число не найдено');
    } else {
      console.log(`   ✅ Найдено ${twentiethDays.length} снимков на 20-е число:`);
      twentiethDays.forEach(snap => {
        const date = snap.fetched_at.toISOString().split('T')[0];
        const time = snap.fetched_at.toISOString().split('T')[1].split('.')[0];
        console.log(`      ${date} ${time} - цена: ${snap.price_hour || 'не указана'}`);
      });
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
  } finally {
    await sql.end();
  }
}

checkAllSnapshots();

