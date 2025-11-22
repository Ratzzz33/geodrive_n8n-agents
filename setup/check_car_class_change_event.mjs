import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

console.log('\n🔍 Поиск события об изменении car_class для авто № 39736...\n');

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  // Ищем событие по rentprog_id = 39736
  // Дата: 20 ноября 2025, время около 9:21
  // Изменение: car_class с "Средний" на "Эконом"
  
  const events = await sql`
    SELECT 
      id,
      ts,
      event_name,
      entity_type,
      operation,
      rentprog_id,
      company_id,
      payload,
      metadata,
      processed,
      ok,
      reason
    FROM events
    WHERE rentprog_id = '39736'
      AND entity_type = 'car'
      AND operation = 'update'
      AND ts >= '2025-11-20 09:00:00'::timestamptz
      AND ts <= '2025-11-20 10:00:00'::timestamptz
    ORDER BY ts DESC
    LIMIT 10;
  `;
  
  console.log(`📊 Найдено событий: ${events.length}\n`);
  
  if (events.length === 0) {
    console.log('❌ Событие не найдено в указанном временном диапазоне.\n');
    console.log('🔍 Расширяем поиск...\n');
    
    // Расширенный поиск - все события по этому авто
    const allEvents = await sql`
      SELECT 
        id,
        ts,
        event_name,
        entity_type,
        operation,
        rentprog_id,
        company_id,
        payload->>'car_class' as car_class,
        payload->'changes' as changes,
        processed,
        ok
      FROM events
      WHERE rentprog_id = '39736'
        AND entity_type = 'car'
      ORDER BY ts DESC
      LIMIT 20;
    `;
    
    console.log(`📊 Всего событий по авто 39736: ${allEvents.length}\n`);
    
    allEvents.forEach((event, idx) => {
      console.log(`\n--- Событие ${idx + 1} ---`);
      console.log(`ID: ${event.id}`);
      console.log(`Время: ${event.ts}`);
      console.log(`Тип: ${event.event_name} (${event.operation})`);
      console.log(`Company ID: ${event.company_id}`);
      console.log(`Car class: ${event.car_class || 'N/A'}`);
      if (event.changes) {
        console.log(`Changes: ${JSON.stringify(event.changes, null, 2)}`);
      }
      console.log(`Processed: ${event.processed}, OK: ${event.ok}`);
    });
    
    // Поиск по payload с упоминанием car_class
    console.log('\n\n🔍 Поиск событий с изменениями car_class в payload...\n');
    
    const carClassEvents = await sql`
      SELECT 
        id,
        ts,
        event_name,
        rentprog_id,
        payload->>'car_class' as current_car_class,
        payload->'changes'->>'car_class' as changed_car_class,
        payload->'changes' as all_changes,
        payload as full_payload
      FROM events
      WHERE rentprog_id = '39736'
        AND (
          payload->>'car_class' IS NOT NULL
          OR payload->'changes'->>'car_class' IS NOT NULL
          OR payload::text LIKE '%car_class%'
        )
      ORDER BY ts DESC
      LIMIT 10;
    `;
    
    console.log(`📊 Событий с car_class: ${carClassEvents.length}\n`);
    
    carClassEvents.forEach((event, idx) => {
      console.log(`\n--- Событие с car_class ${idx + 1} ---`);
      console.log(`ID: ${event.id}`);
      console.log(`Время: ${event.ts}`);
      console.log(`Текущий car_class: ${event.current_car_class || 'N/A'}`);
      console.log(`Изменение car_class: ${event.changed_car_class || 'N/A'}`);
      if (event.all_changes) {
        console.log(`Все изменения: ${JSON.stringify(event.all_changes, null, 2)}`);
      }
      
      // Проверяем есть ли в payload информация об изменении
      if (event.full_payload) {
        const payload = event.full_payload;
        console.log(`\nПолный payload (первые 500 символов):`);
        console.log(JSON.stringify(payload, null, 2).substring(0, 500));
      }
    });
    
  } else {
    events.forEach((event, idx) => {
      console.log(`\n--- Событие ${idx + 1} ---`);
      console.log(`ID: ${event.id}`);
      console.log(`Время: ${event.ts}`);
      console.log(`Тип: ${event.event_name} (${event.operation})`);
      console.log(`Company ID: ${event.company_id}`);
      console.log(`Processed: ${event.processed}, OK: ${event.ok}`);
      
      if (event.payload) {
        console.log(`\nPayload:`);
        console.log(JSON.stringify(event.payload, null, 2));
        
        // Проверяем есть ли car_class в payload
        if (event.payload.car_class) {
          console.log(`\n✅ Car class в payload: ${event.payload.car_class}`);
        }
        
        // Проверяем есть ли информация об изменениях
        if (event.payload.changes) {
          console.log(`\n✅ Изменения:`);
          console.log(JSON.stringify(event.payload.changes, null, 2));
        }
      }
      
      if (event.metadata) {
        console.log(`\nMetadata:`);
        console.log(JSON.stringify(event.metadata, null, 2));
      }
    });
  }
  
  // Дополнительно: проверяем есть ли вообще события по этому авто
  const count = await sql`
    SELECT COUNT(*) as total
    FROM events
    WHERE rentprog_id = '39736'
      AND entity_type = 'car';
  `;
  
  console.log(`\n\n📊 Всего событий по авто 39736 в БД: ${count[0].total}`);
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  console.error(error);
} finally {
  await sql.end();
}

