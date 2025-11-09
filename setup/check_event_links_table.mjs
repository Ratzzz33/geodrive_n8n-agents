import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  // Проверяем существование таблицы
  const tableExists = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'event_links'
    );
  `;
  
  console.log('Table exists:', tableExists[0].exists);
  
  if (tableExists[0].exists) {
    // Проверяем количество записей
    const count = await sql`SELECT COUNT(*) as count FROM event_links`;
    console.log('Records count:', count[0].count);
    
    // Проверяем структуру
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'event_links'
      ORDER BY ordinal_position;
    `;
    console.log('\nColumns:');
    columns.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });
    
    // Тестируем запрос статистики
    const stats = await sql`
      SELECT 
        entity_type,
        link_type,
        confidence,
        matched_by,
        COUNT(*) as total_links,
        COUNT(DISTINCT entity_id) as unique_entities
      FROM event_links
      GROUP BY entity_type, link_type, confidence, matched_by
      ORDER BY total_links DESC
    `;
    
    console.log('\nStats query result:');
    console.log(JSON.stringify(stats, null, 2));
  } else {
    console.log('❌ Table event_links does not exist!');
  }
} catch (error) {
  console.error('Error:', error.message);
  if (error.stack) {
    console.error(error.stack);
  }
} finally {
  await sql.end();
}

