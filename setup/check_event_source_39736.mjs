import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkEventSource() {
  try {
    const rentprogId = '39736';

    console.log(`🔍 Проверка источника изменений для авто rentprog_id=${rentprogId}\n`);

    // 1. Проверяем события с полной информацией
    const events = await sql`
      SELECT 
        id,
        ts,
        type,
        event_name,
        entity_type,
        operation,
        company_id,
        rentprog_id,
        payload,
        metadata,
        processed,
        ok,
        reason
      FROM events
      WHERE (ext_id = ${rentprogId} OR rentprog_id = ${rentprogId})
        AND (type LIKE 'car.%' OR entity_type = 'car' OR payload->>'id' = ${rentprogId})
      ORDER BY ts DESC
      LIMIT 10
    `;

    console.log(`📨 Найдено ${events.length} событий:\n`);

    events.forEach((evt, idx) => {
      const date = evt.ts.toISOString().split('T')[0];
      const time = evt.ts.toISOString().split('T')[1].split('.')[0];
      console.log(`${idx + 1}. ${date} ${time}`);
      console.log(`   Тип: ${evt.type || evt.event_name || 'не указан'}`);
      console.log(`   Операция: ${evt.operation || 'не указана'}`);
      console.log(`   Company ID: ${evt.company_id || 'не указан'}`);
      console.log(`   Обработано: ${evt.processed ? '✅' : '❌'}`);
      console.log(`   Успешно: ${evt.ok ? '✅' : '❌'}`);
      if (evt.reason) {
        console.log(`   Причина ошибки: ${evt.reason}`);
      }

      // Проверяем metadata
      if (evt.metadata) {
        const metadata = typeof evt.metadata === 'string' ? JSON.parse(evt.metadata) : evt.metadata;
        console.log(`   📋 Metadata:`);
        Object.keys(metadata).forEach(key => {
          console.log(`      ${key}: ${JSON.stringify(metadata[key])}`);
        });
      } else {
        console.log(`   📋 Metadata: отсутствует`);
      }

      // Проверяем payload на наличие информации о пользователе/источнике
      if (evt.payload) {
        const payload = typeof evt.payload === 'string' ? JSON.parse(evt.payload) : evt.payload;
        console.log(`   📦 Payload (ключевые поля):`);
        
        // Ищем информацию о пользователе
        const userFields = ['user_id', 'user', 'user_name', 'changed_by', 'updated_by', 'created_by', 'author'];
        const foundUserFields = userFields.filter(field => payload[field] !== undefined);
        if (foundUserFields.length > 0) {
          foundUserFields.forEach(field => {
            console.log(`      👤 ${field}: ${JSON.stringify(payload[field])}`);
          });
        }

        // Ищем информацию об источнике
        const sourceFields = ['source', 'origin', 'from', 'workflow', 'trigger'];
        const foundSourceFields = sourceFields.filter(field => payload[field] !== undefined);
        if (foundSourceFields.length > 0) {
          foundSourceFields.forEach(field => {
            console.log(`      🔧 ${field}: ${JSON.stringify(payload[field])}`);
          });
        }

        // Показываем цену если есть
        if (payload.price_hour !== undefined) {
          console.log(`      💰 price_hour: ${JSON.stringify(payload.price_hour)}`);
        }

        // Показываем все ключи для анализа
        const allKeys = Object.keys(payload);
        const importantKeys = allKeys.filter(k => 
          k.includes('user') || k.includes('source') || k.includes('workflow') || 
          k.includes('trigger') || k.includes('changed') || k.includes('updated') ||
          k.includes('created') || k.includes('author') || k.includes('by')
        );
        if (importantKeys.length > 0) {
          console.log(`      🔑 Важные поля: ${importantKeys.join(', ')}`);
        }
      }
      console.log('');
    });

    // 2. Проверяем entity_timeline
    console.log('📊 Проверка entity_timeline:\n');
    const carInfo = await sql`
      SELECT c.id as car_id FROM external_refs er
      JOIN cars c ON c.id = er.entity_id
      WHERE er.system = 'rentprog'
        AND er.entity_type = 'car'
        AND er.external_id = ${rentprogId}
      LIMIT 1
    `;

    if (carInfo.length > 0) {
      const carId = carInfo[0].car_id;
      const timeline = await sql`
        SELECT 
          id,
          ts,
          source_type,
          source_id,
          event_type,
          operation,
          summary,
          user_name,
          branch_code,
          details
        FROM entity_timeline
        WHERE entity_type = 'car'
          AND entity_id = ${carId}
        ORDER BY ts DESC
        LIMIT 10
      `;

      if (timeline.length === 0) {
        console.log('   ⚠️  Записей в entity_timeline не найдено');
      } else {
        console.log(`   ✅ Найдено ${timeline.length} записей:`);
        timeline.forEach((tl, idx) => {
          const date = tl.ts.toISOString().split('T')[0];
          const time = tl.ts.toISOString().split('T')[1].split('.')[0];
          console.log(`   ${idx + 1}. ${date} ${time}`);
          console.log(`      Источник: ${tl.source_type || 'не указан'}`);
          console.log(`      Source ID: ${tl.source_id || 'не указан'}`);
          console.log(`      Событие: ${tl.event_type || 'не указано'}`);
          console.log(`      Операция: ${tl.operation || 'не указана'}`);
          console.log(`      Пользователь: ${tl.user_name || 'не указан'}`);
          console.log(`      Филиал: ${tl.branch_code || 'не указан'}`);
          if (tl.summary) {
            console.log(`      Описание: ${tl.summary}`);
          }
          if (tl.details) {
            const details = typeof tl.details === 'string' ? JSON.parse(tl.details) : tl.details;
            if (details.price_hour !== undefined) {
              console.log(`      💰 Цена: ${details.price_hour}`);
            }
          }
          console.log('');
        });
      }
    } else {
      console.log('   ⚠️  Автомобиль не найден в БД');
    }

    // 3. Проверяем workflow, которые могут изменять цены
    console.log('🔧 Workflow, которые могут изменять цены:\n');
    console.log('   Проверяем n8n workflows...');
    // Здесь можно добавить проверку через n8n API, но пока просто выводим информацию
    console.log('   📝 Возможные источники изменений:');
    console.log('      1. RentProg Webhook (car_update событие)');
    console.log('      2. RentProg History Parser (парсинг истории)');
    console.log('      3. Snapshot workflow (синхронизация снимков)');
    console.log('      4. Manual update через n8n workflow');
    console.log('      5. Jarvis API /process-event endpoint');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
  } finally {
    await sql.end();
  }
}

checkEventSource();

