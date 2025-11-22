import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkPriceChangesSummary() {
  try {
    const rentprogId = '39736';

    console.log(`🔍 Сводка изменений цены для авто rentprog_id=${rentprogId}\n`);

    // Получаем все события с ценами
    const events = await sql`
      SELECT 
        ts,
        type,
        event_name,
        payload
      FROM events
      WHERE (ext_id = ${rentprogId} OR rentprog_id = ${rentprogId})
        AND payload IS NOT NULL
      ORDER BY ts DESC
      LIMIT 50
    `;

    console.log('📊 История изменений цены из событий:\n');

    const priceHistory = [];
    events.forEach(evt => {
      if (evt.payload) {
        const payload = typeof evt.payload === 'string' ? JSON.parse(evt.payload) : evt.payload;
        if (payload.price_hour !== undefined) {
          const date = evt.ts.toISOString().split('T')[0];
          const time = evt.ts.toISOString().split('T')[1].split('.')[0];
          const price = payload.price_hour;
          
          // Обрабатываем формат "32,27" как два значения
          let priceValue = price;
          if (typeof price === 'string' && price.includes(',')) {
            const parts = price.split(',');
            priceValue = parts.length > 1 ? parseFloat(parts[1]) : parseFloat(parts[0]);
          } else if (Array.isArray(price)) {
            priceValue = price[price.length - 1]; // Берем последнее значение
          }
          
          priceHistory.push({
            date: date,
            time: time,
            price: priceValue,
            fullPrice: price,
            timestamp: evt.ts
          });
        }
      }
    });

    if (priceHistory.length === 0) {
      console.log('   ⚠️  Изменений цены в событиях не найдено');
    } else {
      console.log(`   ✅ Найдено ${priceHistory.length} записей с ценой:\n`);
      
      // Группируем по датам
      const byDate = {};
      priceHistory.forEach(ph => {
        if (!byDate[ph.date]) {
          byDate[ph.date] = [];
        }
        byDate[ph.date].push(ph);
      });

      // Выводим по датам
      const dates = Object.keys(byDate).sort().reverse();
      dates.forEach(date => {
        const prices = byDate[date];
        console.log(`   📅 ${date}:`);
        prices.forEach((ph, idx) => {
          console.log(`      ${idx + 1}. ${ph.time} - цена: ${ph.price} (из события: ${ph.fullPrice})`);
        });
        
        // Проверяем изменения в течение дня
        if (prices.length > 1) {
          const uniquePrices = [...new Set(prices.map(p => p.price))];
          if (uniquePrices.length > 1) {
            console.log(`      ⚠️  ИЗМЕНЕНИЕ ЦЕНЫ в течение дня: ${uniquePrices.join(' → ')}`);
          }
        }
        console.log('');
      });

      // Проверяем конкретно 20-е число
      console.log('📅 Проверка 20-х чисел:\n');
      const twentieth = priceHistory.filter(ph => {
        const day = new Date(ph.timestamp).getDate();
        return day === 20;
      });

      if (twentieth.length === 0) {
        console.log('   ⚠️  Событий с ценой на 20-е число не найдено');
      } else {
        console.log(`   ✅ Найдено ${twentieth.length} событий на 20-е число:`);
        twentieth.forEach((ph, idx) => {
          const month = new Date(ph.timestamp).toLocaleString('ru', { month: 'long' });
          console.log(`      ${idx + 1}. ${ph.date} ${ph.time} - цена: ${ph.price}`);
        });
        
        // Проверяем изменения утром (6:00-12:00)
        const morning = twentieth.filter(ph => {
          const hour = new Date(ph.timestamp).getHours();
          return hour >= 6 && hour < 12;
        });
        
        if (morning.length > 0) {
          console.log(`\n   🌅 Утром (6:00-12:00) на 20-е число:`);
          morning.forEach((ph, idx) => {
            console.log(`      ${idx + 1}. ${ph.date} ${ph.time} - цена: ${ph.price}`);
          });
          
          if (morning.length > 1) {
            const uniqueMorningPrices = [...new Set(morning.map(p => p.price))];
            if (uniqueMorningPrices.length > 1) {
              console.log(`\n   ⚠️  ИЗМЕНЕНИЕ ЦЕНЫ УТРОМ 20-ГО: ${uniqueMorningPrices.join(' → ')}`);
            }
          }
        } else {
          console.log(`\n   ⚠️  Событий утром (6:00-12:00) на 20-е число не найдено`);
        }
      }
    }

    // Проверяем снимки состояний
    console.log('\n📸 История цен из снимков состояний:\n');
    const snapshots = await sql`
      SELECT 
        fetched_at,
        price_hour
      FROM rentprog_car_states_snapshot
      WHERE rentprog_id = ${rentprogId}
      ORDER BY fetched_at DESC
      LIMIT 20
    `;

    if (snapshots.length === 0) {
      console.log('   ⚠️  Снимков не найдено');
    } else {
      console.log(`   ✅ Найдено ${snapshots.length} снимков:`);
      snapshots.forEach((snap, idx) => {
        const date = snap.fetched_at.toISOString().split('T')[0];
        const time = snap.fetched_at.toISOString().split('T')[1].split('.')[0];
        const day = snap.fetched_at.getDate();
        const marker = day === 20 ? '📅' : '   ';
        console.log(`   ${marker} ${idx + 1}. ${date} ${time} - цена: ${snap.price_hour || 'не указана'}`);
      });
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
  } finally {
    await sql.end();
  }
}

checkPriceChangesSummary();

