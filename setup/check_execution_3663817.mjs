import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

console.log('\n🔍 Проверка сохранения события operation_id = 3663817 (изменение car_class)...\n');

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  // Ищем событие по operation_id
  const event = await sql`
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
      processed
    FROM history
    WHERE operation_id = '3663817';
  `;
  
  if (event.length > 0) {
    console.log('✅ Событие НАЙДЕНО в таблице history:\n');
    const e = event[0];
    console.log(`ID: ${e.id}`);
    console.log(`Время добавления: ${e.ts}`);
    console.log(`Время операции: ${e.created_at}`);
    console.log(`Филиал: ${e.branch}`);
    console.log(`Тип операции: ${e.operation_type}`);
    console.log(`Operation ID: ${e.operation_id}`);
    console.log(`Описание: ${e.description}`);
    console.log(`Тип сущности: ${e.entity_type || 'NULL'}`);
    console.log(`ID сущности: ${e.entity_id || 'NULL'}`);
    console.log(`Пользователь: ${e.user_name || 'NULL'}`);
    console.log(`Matched: ${e.matched}, Processed: ${e.processed}`);
    
    if (e.raw_data) {
      console.log(`\nRaw data:`);
      console.log(JSON.stringify(e.raw_data, null, 2));
    }
  } else {
    console.log('❌ Событие НЕ НАЙДЕНО в таблице history\n');
    console.log('🔍 Проверяем все события от 20 ноября 09:21...\n');
    
    const events = await sql`
      SELECT 
        id,
        ts,
        branch,
        operation_id,
        description,
        entity_id,
        created_at
      FROM history
      WHERE created_at >= '2025-11-20 09:20:00'::timestamptz
        AND created_at <= '2025-11-20 09:25:00'::timestamptz
      ORDER BY created_at DESC
      LIMIT 20;
    `;
    
    console.log(`📊 Найдено событий в этом диапазоне: ${events.length}\n`);
    events.forEach((e, idx) => {
      console.log(`${idx + 1}. ${e.created_at} | ${e.branch} | op_id: ${e.operation_id} | entity: ${e.entity_id || 'N/A'}`);
      console.log(`   ${e.description?.substring(0, 80) || 'N/A'}...\n`);
    });
    
    // Проверяем есть ли события по авто 39736
    console.log('\n🔍 Проверяем все события по авто 39736:\n');
    
    const carEvents = await sql`
      SELECT 
        id,
        ts,
        branch,
        operation_id,
        description,
        created_at
      FROM history
      WHERE entity_id = '39736'
        OR description LIKE '%39736%'
      ORDER BY created_at DESC
      LIMIT 10;
    `;
    
    console.log(`📊 Найдено событий по авто 39736: ${carEvents.length}\n`);
    carEvents.forEach((e, idx) => {
      console.log(`${idx + 1}. ${e.created_at} | ${e.branch} | op_id: ${e.operation_id}`);
      console.log(`   ${e.description || 'N/A'}\n`);
    });
  }
  
  // Проверяем constraint таблицы history
  console.log('\n🔍 Проверка constraint таблицы history:\n');
  
  const constraints = await sql`
    SELECT 
      conname as constraint_name,
      pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = 'history'::regclass
      AND contype = 'u';
  `;
  
  console.log('Unique constraints:');
  constraints.forEach(c => {
    console.log(`   ${c.constraint_name}: ${c.definition}`);
  });
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  console.error(error);
} finally {
  await sql.end();
}

