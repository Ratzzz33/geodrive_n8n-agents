import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

console.log('\n🔍 Детальная проверка события об изменении car_class...\n');

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  // 1. Проверяем найденное событие детально
  console.log('1️⃣ Проверка события ID 359 (авто 39736, 5 ноября):\n');
  
  const event359 = await sql`
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
      ok
    FROM events
    WHERE id = 359;
  `;
  
  if (event359.length > 0) {
    const e = event359[0];
    console.log(`ID: ${e.id}`);
    console.log(`Время: ${e.ts}`);
    console.log(`Тип: ${e.event_name} (${e.operation})`);
    console.log(`RentProg ID: ${e.rentprog_id}`);
    console.log(`Company ID: ${e.company_id}`);
    console.log(`\nПолный payload:`);
    console.log(JSON.stringify(e.payload, null, 2));
    console.log(`\nMetadata:`);
    console.log(JSON.stringify(e.metadata, null, 2));
  }
  
  // 2. Ищем события от 20 ноября 2025
  console.log('\n\n2️⃣ Поиск всех событий от 20 ноября 2025:\n');
  
  const nov20Events = await sql`
    SELECT 
      id,
      ts,
      event_name,
      entity_type,
      operation,
      rentprog_id,
      company_id,
      payload->>'car_class' as car_class,
      payload->'changes' as changes
    FROM events
    WHERE ts >= '2025-11-20 00:00:00'::timestamptz
      AND ts < '2025-11-21 00:00:00'::timestamptz
    ORDER BY ts DESC
    LIMIT 50;
  `;
  
  console.log(`📊 Найдено событий от 20 ноября: ${nov20Events.length}\n`);
  
  if (nov20Events.length > 0) {
    console.log('Первые 10 событий:');
    nov20Events.slice(0, 10).forEach((event, idx) => {
      console.log(`\n--- ${idx + 1} ---`);
      console.log(`ID: ${event.id}`);
      console.log(`Время: ${event.ts}`);
      console.log(`Тип: ${event.event_name} (${event.operation})`);
      console.log(`RentProg ID: ${event.rentprog_id}`);
      console.log(`Car class: ${event.car_class || 'N/A'}`);
    });
  }
  
  // 3. Ищем события с изменениями car_class (любая дата)
  console.log('\n\n3️⃣ Поиск всех событий с изменениями car_class:\n');
  
  const carClassChangeEvents = await sql`
    SELECT 
      id,
      ts,
      event_name,
      rentprog_id,
      company_id,
      payload->>'car_class' as current_car_class,
      payload->'changes'->>'car_class' as changed_car_class,
      payload->'changes' as all_changes
    FROM events
    WHERE entity_type = 'car'
      AND (
        payload->>'car_class' IS NOT NULL
        OR payload->'changes'->>'car_class' IS NOT NULL
        OR payload::text LIKE '%car_class%'
        OR payload::text LIKE '%Средний%'
        OR payload::text LIKE '%Эконом%'
      )
    ORDER BY ts DESC
    LIMIT 20;
  `;
  
  console.log(`📊 Найдено событий с car_class: ${carClassChangeEvents.length}\n`);
  
  carClassChangeEvents.forEach((event, idx) => {
    console.log(`\n--- Событие ${idx + 1} ---`);
    console.log(`ID: ${event.id}`);
    console.log(`Время: ${event.ts}`);
    console.log(`RentProg ID: ${event.rentprog_id}`);
    console.log(`Company ID: ${event.company_id}`);
    console.log(`Текущий car_class: ${event.current_car_class || 'N/A'}`);
    console.log(`Изменение car_class: ${event.changed_car_class || 'N/A'}`);
    if (event.all_changes) {
      console.log(`Все изменения: ${JSON.stringify(event.all_changes, null, 2)}`);
    }
  });
  
  // 4. Проверяем есть ли другие таблицы с историей изменений
  console.log('\n\n4️⃣ Проверка других таблиц с историей:\n');
  
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND (
        table_name LIKE '%history%'
        OR table_name LIKE '%event%'
        OR table_name LIKE '%log%'
        OR table_name LIKE '%change%'
        OR table_name LIKE '%audit%'
      )
    ORDER BY table_name;
  `;
  
  console.log(`📊 Найдено таблиц: ${tables.length}`);
  tables.forEach(t => {
    console.log(`   - ${t.table_name}`);
  });
  
  // 5. Проверяем таблицу cars - может там есть история?
  console.log('\n\n5️⃣ Проверка структуры таблицы cars:\n');
  
  const carsColumns = await sql`
    SELECT 
      column_name,
      data_type
    FROM information_schema.columns
    WHERE table_name = 'cars'
    ORDER BY ordinal_position;
  `;
  
  if (carsColumns.length > 0) {
    console.log('Колонки таблицы cars:');
    carsColumns.forEach(c => {
      console.log(`   ${c.column_name.padEnd(30)} ${c.data_type}`);
    });
    
    // Проверяем есть ли запись об авто 39736
    const car39736 = await sql`
      SELECT *
      FROM cars c
      JOIN external_refs er ON er.entity_type = 'car' AND er.entity_id = c.id
      WHERE er.system = 'rentprog'
        AND er.external_id = '39736'
      LIMIT 1;
    `;
    
    if (car39736.length > 0) {
      console.log('\n\n✅ Найдена запись об авто 39736 в таблице cars:');
      console.log(JSON.stringify(car39736[0], null, 2));
    } else {
      console.log('\n\n❌ Авто 39736 не найдено в таблице cars');
    }
  }
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  console.error(error);
} finally {
  await sql.end();
}

