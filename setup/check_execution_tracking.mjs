import postgres from 'postgres';

const sql = postgres(
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
  { max: 1, ssl: { rejectUnauthorized: false } }
);

try {
  console.log('Checking events table for execution tracking...\n');
  
  // Получить последние 5 событий
  const recentEvents = await sql`
    SELECT 
      id,
      event_name,
      rentprog_id,
      execution_id,
      execution_url,
      ts
    FROM events
    ORDER BY ts DESC
    LIMIT 5
  `;
  
  console.log('Last 5 events:');
  recentEvents.forEach((event, index) => {
    console.log(`\n${index + 1}. Event #${event.id}`);
    console.log(`   Name: ${event.event_name}`);
    console.log(`   RentProg ID: ${event.rentprog_id}`);
    console.log(`   Execution ID: ${event.execution_id || 'NOT SET'}`);
    console.log(`   Execution URL: ${event.execution_url || 'NOT SET'}`);
    console.log(`   Timestamp: ${event.ts}`);
  });
  
  // Статистика
  const stats = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(execution_id) as with_exec_id,
      COUNT(execution_url) as with_exec_url
    FROM events
  `;
  
  console.log('\n=== Statistics ===');
  console.log(`Total events: ${stats[0].total}`);
  console.log(`With execution_id: ${stats[0].with_exec_id}`);
  console.log(`With execution_url: ${stats[0].with_exec_url}`);
  
  if (stats[0].with_exec_id > 0) {
    console.log('\n✅ Execution tracking is working!');
  } else {
    console.log('\n⚠️ No events with execution tracking yet (workflows may not have been triggered since update)');
  }
  
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await sql.end();
}

