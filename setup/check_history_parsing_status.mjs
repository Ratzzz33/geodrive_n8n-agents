import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

console.log('\n🔍 Проверка статуса парсинга истории...\n');

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  // 1. Проверяем последние события в history
  console.log('1️⃣ Последние 10 событий в history:\n');
  
  const lastEvents = await sql`
    SELECT 
      id,
      ts,
      created_at,
      branch,
      operation_type,
      description,
      entity_type,
      entity_id,
      user_name
    FROM history
    ORDER BY created_at DESC
    LIMIT 10;
  `;
  
  console.log(`📊 Последние события:\n`);
  lastEvents.forEach((event, idx) => {
    console.log(`${idx + 1}. ${event.created_at} | ${event.branch} | ${event.operation_type} | ${event.entity_type} ${event.entity_id} | ${event.user_name || 'N/A'}`);
    console.log(`   ${event.description || 'N/A'}\n`);
  });
  
  // 2. Проверяем есть ли события от 20 ноября вообще
  console.log('\n2️⃣ События от 20 ноября 2025:\n');
  
  const nov20Events = await sql`
    SELECT 
      id,
      created_at,
      branch,
      operation_type,
      description,
      entity_type,
      entity_id,
      user_name
    FROM history
    WHERE created_at >= '2025-11-20 00:00:00'::timestamptz
      AND created_at < '2025-11-21 00:00:00'::timestamptz
    ORDER BY created_at DESC
    LIMIT 20;
  `;
  
  console.log(`📊 Найдено событий от 20 ноября: ${nov20Events.length}\n`);
  
  if (nov20Events.length > 0) {
    nov20Events.forEach((event, idx) => {
      console.log(`${idx + 1}. ${event.created_at} | ${event.branch} | ${event.operation_type} | ${event.entity_type} ${event.entity_id} | ${event.user_name || 'N/A'}`);
      console.log(`   ${event.description || 'N/A'}\n`);
    });
  } else {
    console.log('❌ Событий от 20 ноября нет в таблице history\n');
  }
  
  // 3. Проверяем диапазон дат в history
  console.log('\n3️⃣ Диапазон дат в history:\n');
  
  const dateRange = await sql`
    SELECT 
      MIN(created_at) as min_date,
      MAX(created_at) as max_date,
      COUNT(*) as total
    FROM history;
  `;
  
  console.log(`Минимальная дата: ${dateRange[0].min_date}`);
  console.log(`Максимальная дата: ${dateRange[0].max_date}`);
  console.log(`Всего записей: ${dateRange[0].total}`);
  
  // 4. Проверяем события по филиалам от 20 ноября
  console.log('\n4️⃣ События по филиалам от 20 ноября:\n');
  
  const byBranch = await sql`
    SELECT 
      branch,
      COUNT(*) as count,
      MIN(created_at) as first_event,
      MAX(created_at) as last_event
    FROM history
    WHERE created_at >= '2025-11-20 00:00:00'::timestamptz
      AND created_at < '2025-11-21 00:00:00'::timestamptz
    GROUP BY branch
    ORDER BY count DESC;
  `;
  
  console.log(`📊 События по филиалам:\n`);
  byBranch.forEach(b => {
    console.log(`${b.branch}: ${b.count} событий (${b.first_event} - ${b.last_event})`);
  });
  
  // 5. Проверяем есть ли вообще события об изменении car_class
  console.log('\n5️⃣ Поиск всех событий с упоминанием car_class:\n');
  
  const carClassEvents = await sql`
    SELECT 
      id,
      created_at,
      branch,
      operation_type,
      description,
      entity_type,
      entity_id,
      user_name,
      raw_data->>'car_class' as car_class
    FROM history
    WHERE (
      description ILIKE '%car_class%'
      OR description ILIKE '%класс%'
      OR raw_data::text ILIKE '%car_class%'
    )
    ORDER BY created_at DESC
    LIMIT 10;
  `;
  
  console.log(`📊 Найдено событий с car_class: ${carClassEvents.length}\n`);
  
  carClassEvents.forEach((event, idx) => {
    console.log(`${idx + 1}. ${event.created_at} | ${event.branch} | ${event.entity_type} ${event.entity_id}`);
    console.log(`   ${event.description || 'N/A'}`);
    console.log(`   Car class: ${event.car_class || 'N/A'}\n`);
  });
  
  // 6. Проверяем события от CEO Eliseev
  console.log('\n6️⃣ Последние события от CEO Eliseev:\n');
  
  const ceoEvents = await sql`
    SELECT 
      id,
      created_at,
      branch,
      operation_type,
      description,
      entity_type,
      entity_id,
      user_name
    FROM history
    WHERE (
      user_name ILIKE '%Eliseev%'
      OR user_name ILIKE '%CEO%'
    )
    ORDER BY created_at DESC
    LIMIT 10;
  `;
  
  console.log(`📊 Найдено событий: ${ceoEvents.length}\n`);
  
  ceoEvents.forEach((event, idx) => {
    console.log(`${idx + 1}. ${event.created_at} | ${event.branch} | ${event.operation_type} | ${event.entity_type} ${event.entity_id}`);
    console.log(`   ${event.description || 'N/A'}\n`);
  });
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  console.error(error);
} finally {
  await sql.end();
}

