import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkEventPayload() {
  try {
    const rentprogId = '39736';

    console.log(`🔍 Проверка payload событий для авто rentprog_id=${rentprogId}\n`);

    // Получаем все события с payload
    const events = await sql`
      SELECT 
        id,
        type,
        event_name,
        entity_type,
        operation,
        ts,
        company_id,
        rentprog_id,
        ext_id,
        payload,
        metadata
      FROM events
      WHERE (ext_id = ${rentprogId} OR rentprog_id = ${rentprogId})
        AND (type LIKE 'car.%' OR entity_type = 'car')
      ORDER BY ts DESC
      LIMIT 10
    `;

    if (events.length === 0) {
      console.log('❌ Событий не найдено');
      return;
    }

    console.log(`✅ Найдено ${events.length} событий:\n`);

    events.forEach((evt, idx) => {
      const date = evt.ts.toISOString().split('T')[0];
      const time = evt.ts.toISOString().split('T')[1].split('.')[0];
      console.log(`${idx + 1}. ${date} ${time}`);
      console.log(`   Тип: ${evt.type || evt.event_name || 'не указан'}`);
      console.log(`   Операция: ${evt.operation || 'не указана'}`);
      console.log(`   Company ID: ${evt.company_id || 'не указан'}`);
      
      if (evt.payload) {
        const payload = typeof evt.payload === 'string' ? JSON.parse(evt.payload) : evt.payload;
        
        // Ищем информацию о цене
        if (payload.price_hour !== undefined) {
          console.log(`   💰 Цена за час: ${payload.price_hour}`);
        }
        if (payload.price !== undefined) {
          console.log(`   💰 Цена: ${payload.price}`);
        }
        if (payload.prices) {
          console.log(`   💰 Цены: ${JSON.stringify(payload.prices)}`);
        }
        
        // Показываем ключевые поля
        const keys = Object.keys(payload).filter(k => 
          k.includes('price') || k.includes('mileage') || k.includes('state') || k === 'id'
        );
        if (keys.length > 0) {
          console.log(`   📋 Ключевые поля: ${keys.join(', ')}`);
        }
      }
      console.log('');
    });

    // Проверяем события на 20-е число с payload
    console.log('📅 События на 20-е число с проверкой payload:');
    const twentiethEvents = await sql`
      SELECT 
        ts,
        type,
        event_name,
        payload
      FROM events
      WHERE (ext_id = ${rentprogId} OR rentprog_id = ${rentprogId})
        AND EXTRACT(DAY FROM ts) = 20
      ORDER BY ts DESC
      LIMIT 10
    `;

    if (twentiethEvents.length === 0) {
      console.log('   ⚠️  Событий на 20-е число не найдено');
    } else {
      console.log(`   ✅ Найдено ${twentiethEvents.length} событий:`);
      twentiethEvents.forEach((evt, idx) => {
        const date = evt.ts.toISOString().split('T')[0];
        const time = evt.ts.toISOString().split('T')[1].split('.')[0];
        console.log(`   ${idx + 1}. ${date} ${time} - ${evt.type || evt.event_name || 'не указан'}`);
        
        if (evt.payload) {
          const payload = typeof evt.payload === 'string' ? JSON.parse(evt.payload) : evt.payload;
          if (payload.price_hour !== undefined) {
            console.log(`      💰 Цена за час: ${payload.price_hour}`);
          }
        }
      });
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
  } finally {
    await sql.end();
  }
}

checkEventPayload();

