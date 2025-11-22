import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

console.log('\n🔍 Поиск в таблице history события об изменении car_class для авто № 39736...\n');

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  // Ищем событие об изменении car_class для авто 39736
  // Дата: 20 ноября 2025, время около 9:21
  // Пользователь: CEO Eliseev Aleksei
  // Изменение: car_class с "Средний" на "Эконом"
  
  console.log('1️⃣ Поиск событий по авто 39736 от 20 ноября 2025:\n');
  
  const events = await sql`
    SELECT 
      id,
      ts,
      branch,
      operation_type,
      operation_id,
      description,
      entity_type,
      entity_id,
      user_name,
      created_at,
      raw_data,
      matched,
      processed,
      notes
    FROM history
    WHERE entity_id = '39736'
      AND entity_type = 'car'
      AND created_at >= '2025-11-20 09:00:00'::timestamptz
      AND created_at <= '2025-11-20 10:00:00'::timestamptz
    ORDER BY created_at DESC
    LIMIT 10;
  `;
  
  console.log(`📊 Найдено событий: ${events.length}\n`);
  
  if (events.length > 0) {
    events.forEach((event, idx) => {
      console.log(`\n--- Событие ${idx + 1} ---`);
      console.log(`ID: ${event.id}`);
      console.log(`Время операции: ${event.created_at}`);
      console.log(`Время добавления: ${event.ts}`);
      console.log(`Филиал: ${event.branch}`);
      console.log(`Тип операции: ${event.operation_type}`);
      console.log(`Описание: ${event.description}`);
      console.log(`Пользователь: ${event.user_name}`);
      console.log(`Matched: ${event.matched}, Processed: ${event.processed}`);
      
      if (event.raw_data) {
        console.log(`\nRaw data:`);
        console.log(JSON.stringify(event.raw_data, null, 2));
        
        // Проверяем есть ли car_class в raw_data
        if (event.raw_data.car_class) {
          console.log(`\n✅ Car class в raw_data: ${event.raw_data.car_class}`);
        }
        
        // Проверяем есть ли информация об изменениях
        if (event.raw_data.changes) {
          console.log(`\n✅ Изменения:`);
          console.log(JSON.stringify(event.raw_data.changes, null, 2));
        }
        
        // Проверяем есть ли упоминание "Средний" или "Эконом"
        const rawStr = JSON.stringify(event.raw_data);
        if (rawStr.includes('Средний') || rawStr.includes('Эконом')) {
          console.log(`\n✅ Найдено упоминание "Средний" или "Эконом" в raw_data`);
        }
      }
      
      if (event.notes) {
        console.log(`\nЗаметки: ${event.notes}`);
      }
    });
  } else {
    console.log('❌ Событие не найдено в указанном временном диапазоне.\n');
    
    // Расширенный поиск - все события по этому авто
    console.log('🔍 Расширяем поиск - все события по авто 39736:\n');
    
    const allEvents = await sql`
      SELECT 
        id,
        ts,
        created_at,
        branch,
        operation_type,
        description,
        user_name,
        raw_data->>'car_class' as car_class,
        raw_data->'changes' as changes
      FROM history
      WHERE entity_id = '39736'
        AND entity_type = 'car'
      ORDER BY created_at DESC
      LIMIT 20;
    `;
    
    console.log(`📊 Всего событий по авто 39736 в history: ${allEvents.length}\n`);
    
    allEvents.forEach((event, idx) => {
      console.log(`\n--- Событие ${idx + 1} ---`);
      console.log(`ID: ${event.id}`);
      console.log(`Время операции: ${event.created_at}`);
      console.log(`Тип: ${event.operation_type}`);
      console.log(`Описание: ${event.description}`);
      console.log(`Пользователь: ${event.user_name}`);
      console.log(`Car class: ${event.car_class || 'N/A'}`);
    });
    
    // Поиск по описанию с упоминанием car_class или изменений
    console.log('\n\n🔍 Поиск событий с упоминанием "car_class", "Средний", "Эконом":\n');
    
    const carClassEvents = await sql`
      SELECT 
        id,
        ts,
        created_at,
        branch,
        operation_type,
        description,
        user_name,
        raw_data
      FROM history
      WHERE entity_id = '39736'
        AND entity_type = 'car'
        AND (
          description ILIKE '%car_class%'
          OR description ILIKE '%Средний%'
          OR description ILIKE '%Эконом%'
          OR description ILIKE '%класс%'
          OR raw_data::text ILIKE '%car_class%'
          OR raw_data::text ILIKE '%Средний%'
          OR raw_data::text ILIKE '%Эконом%'
        )
      ORDER BY created_at DESC
      LIMIT 10;
    `;
    
    console.log(`📊 Найдено событий с упоминанием car_class: ${carClassEvents.length}\n`);
    
    carClassEvents.forEach((event, idx) => {
      console.log(`\n--- Событие ${idx + 1} ---`);
      console.log(`ID: ${event.id}`);
      console.log(`Время операции: ${event.created_at}`);
      console.log(`Тип: ${event.operation_type}`);
      console.log(`Описание: ${event.description}`);
      console.log(`Пользователь: ${event.user_name}`);
      if (event.raw_data) {
        console.log(`\nRaw data (первые 500 символов):`);
        console.log(JSON.stringify(event.raw_data, null, 2).substring(0, 500));
      }
    });
  }
  
  // Поиск по пользователю "Eliseev" или "CEO"
  console.log('\n\n2️⃣ Поиск событий от пользователя "Eliseev" или "CEO" от 20 ноября:\n');
  
  const userEvents = await sql`
    SELECT 
      id,
      ts,
      created_at,
      branch,
      operation_type,
      description,
      user_name,
      entity_id,
      raw_data
    FROM history
    WHERE (
      user_name ILIKE '%Eliseev%'
      OR user_name ILIKE '%CEO%'
    )
      AND created_at >= '2025-11-20 09:00:00'::timestamptz
      AND created_at <= '2025-11-20 10:00:00'::timestamptz
    ORDER BY created_at DESC
    LIMIT 20;
  `;
  
  console.log(`📊 Найдено событий от пользователя: ${userEvents.length}\n`);
  
  userEvents.forEach((event, idx) => {
    console.log(`\n--- Событие ${idx + 1} ---`);
    console.log(`ID: ${event.id}`);
    console.log(`Время: ${event.created_at}`);
    console.log(`Пользователь: ${event.user_name}`);
    console.log(`Тип: ${event.operation_type}`);
    console.log(`Описание: ${event.description}`);
    console.log(`Entity ID: ${event.entity_id}`);
    
    if (event.entity_id === '39736') {
      console.log(`\n✅ ЭТО СОБЫТИЕ ПО АВТО 39736!`);
      if (event.raw_data) {
        console.log(`\nRaw data:`);
        console.log(JSON.stringify(event.raw_data, null, 2));
      }
    }
  });
  
  // Общая статистика по таблице history
  console.log('\n\n3️⃣ Статистика по таблице history:\n');
  
  const stats = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE entity_id = '39736') as events_39736,
      COUNT(*) FILTER (WHERE created_at >= '2025-11-20'::date AND created_at < '2025-11-21'::date) as events_nov20,
      COUNT(*) FILTER (WHERE user_name ILIKE '%Eliseev%' OR user_name ILIKE '%CEO%') as events_ceo
    FROM history;
  `;
  
  console.log(`Всего записей в history: ${stats[0].total}`);
  console.log(`Событий по авто 39736: ${stats[0].events_39736}`);
  console.log(`Событий от 20 ноября: ${stats[0].events_nov20}`);
  console.log(`Событий от CEO/Eliseev: ${stats[0].events_ceo}`);
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  console.error(error);
} finally {
  await sql.end();
}

