import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('📋 Структура таблицы events:');
  const columns = await sql`
    SELECT 
      column_name, 
      data_type, 
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_name = 'events'
    ORDER BY ordinal_position;
  `;
  
  console.table(columns);
  
  console.log('\n📊 Последние 5 записей (все колонки):');
  const recent = await sql`
    SELECT *
    FROM events
    ORDER BY ts DESC
    LIMIT 5;
  `;
  
  console.table(recent);
  
  console.log('\n🔍 Откуда берётся "car.update":');
  const carUpdates = await sql`
    SELECT 
      id,
      ts,
      type,
      event_name,
      entity_type,
      operation,
      execution_id,
      execution_url
    FROM events
    WHERE type LIKE 'car.%'
    ORDER BY ts DESC
    LIMIT 5;
  `;
  
  console.table(carUpdates);
  
} finally {
  await sql.end();
}

