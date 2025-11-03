import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('Проверка таблиц БД...\n');
  
  // Проверка существования таблиц
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('events', 'sync_runs', 'health')
    ORDER BY table_name
  `;
  
  console.log('Найденные таблицы:');
  tables.forEach(row => {
    console.log(`  ✓ ${row.table_name}`);
  });
  
  // Проверка структуры events
  if (tables.find(t => t.table_name === 'events')) {
    const eventsColumns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'events'
      ORDER BY ordinal_position
    `;
    console.log('\nСтруктура таблицы events:');
    eventsColumns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });
    
    // Проверка constraint для дедупликации
    const constraints = await sql`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'events'
      AND constraint_type = 'UNIQUE'
    `;
    console.log('\nUnique constraints:');
    constraints.forEach(c => {
      console.log(`  ✓ ${c.constraint_name}`);
    });
    
    // Проверка индексов
    const indexes = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'events'
    `;
    console.log('\nИндексы:');
    indexes.forEach(idx => {
      console.log(`  ✓ ${idx.indexname}`);
    });
    
    // Количество записей
    const count = await sql`SELECT COUNT(*) as cnt FROM events`;
    console.log(`\nЗаписей в events: ${count[0].cnt}`);
    
    const unprocessed = await sql`SELECT COUNT(*) as cnt FROM events WHERE processed = FALSE`;
    console.log(`Необработанных событий: ${unprocessed[0].cnt}`);
  }
  
  // Проверка health
  if (tables.find(t => t.table_name === 'health')) {
    const healthCount = await sql`SELECT COUNT(*) as cnt FROM health`;
    console.log(`\nЗаписей в health: ${healthCount[0].cnt}`);
  }
  
  // Проверка sync_runs
  if (tables.find(t => t.table_name === 'sync_runs')) {
    const syncCount = await sql`SELECT COUNT(*) as cnt FROM sync_runs`;
    console.log(`\nЗаписей в sync_runs: ${syncCount[0].cnt}`);
  }
  
  console.log('\n✅ Проверка завершена');
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}
