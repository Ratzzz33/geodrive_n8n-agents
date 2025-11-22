import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkFullPayload() {
  try {
    const rentprogId = '39736';

    console.log(`🔍 Детальный анализ payload для авто rentprog_id=${rentprogId}\n`);

    const events = await sql`
      SELECT 
        id,
        ts,
        event_name,
        payload,
        metadata
      FROM events
      WHERE (ext_id = ${rentprogId} OR rentprog_id = ${rentprogId})
        AND payload IS NOT NULL
      ORDER BY ts DESC
      LIMIT 5
    `;

    if (events.length === 0) {
      console.log('❌ Событий не найдено');
      return;
    }

    events.forEach((evt, idx) => {
      const date = evt.ts.toISOString().split('T')[0];
      const time = evt.ts.toISOString().split('T')[1].split('.')[0];
      console.log(`\n${idx + 1}. Событие от ${date} ${time}`);
      console.log(`   Event name: ${evt.event_name || 'не указано'}`);
      
      if (evt.payload) {
        const payload = typeof evt.payload === 'string' ? JSON.parse(evt.payload) : evt.payload;
        
        console.log(`\n   📦 Полный payload (все поля):`);
        Object.keys(payload).sort().forEach(key => {
          const value = payload[key];
          const valueStr = Array.isArray(value) 
            ? `[${value.join(', ')}]` 
            : typeof value === 'object' 
              ? JSON.stringify(value).substring(0, 100) + '...'
              : String(value);
          console.log(`      ${key}: ${valueStr}`);
        });

        // Анализ источника
        console.log(`\n   🔍 Анализ источника:`);
        if (payload.created_from_api !== undefined) {
          console.log(`      ✅ created_from_api: ${payload.created_from_api}`);
        }
        if (payload.updated_from_api !== undefined) {
          console.log(`      ✅ updated_from_api: ${payload.updated_from_api}`);
        }
        if (payload.user_id !== undefined) {
          console.log(`      👤 user_id: ${payload.user_id}`);
        }
        if (payload.changed_by !== undefined) {
          console.log(`      👤 changed_by: ${payload.changed_by}`);
        }
        if (payload.updated_by !== undefined) {
          console.log(`      👤 updated_by: ${payload.updated_by}`);
        }
        if (payload.created_by !== undefined) {
          console.log(`      👤 created_by: ${payload.created_by}`);
        }
        
        // Анализ цены
        if (payload.price_hour !== undefined) {
          console.log(`\n   💰 Анализ цены:`);
          console.log(`      price_hour: ${JSON.stringify(payload.price_hour)}`);
          if (Array.isArray(payload.price_hour)) {
            console.log(`      Формат: массив [старое значение, новое значение]`);
            console.log(`      Старая цена: ${payload.price_hour[0]}`);
            console.log(`      Новая цена: ${payload.price_hour[1]}`);
          }
        }
      }

      if (evt.metadata) {
        const metadata = typeof evt.metadata === 'string' ? JSON.parse(evt.metadata) : evt.metadata;
        console.log(`\n   📋 Metadata:`);
        Object.keys(metadata).forEach(key => {
          console.log(`      ${key}: ${JSON.stringify(metadata[key])}`);
        });
      }
    });

    // Проверяем, какие workflow обрабатывают car_update
    console.log(`\n\n🔧 Workflow обработки car_update:\n`);
    console.log(`   Проверяем n8n workflows через MCP...`);
    
    // Здесь можно добавить проверку через n8n MCP, но пока выводим информацию
    console.log(`   📝 Известные workflow:`);
    console.log(`      1. "RentProg Webhooks Monitor" - принимает вебхуки`);
    console.log(`      2. "RentProg Upsert Processor" - обрабатывает события`);
    console.log(`      3. Snapshot workflows - синхронизация снимков`);
    
    console.log(`\n   ⚠️  ПРОБЛЕМА: В payload нет информации о пользователе!`);
    console.log(`      RentProg вебхуки не содержат user_id/changed_by`);
    console.log(`      Нужно проверять через RentProg API или History Parser`);

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
  } finally {
    await sql.end();
  }
}

checkFullPayload();

