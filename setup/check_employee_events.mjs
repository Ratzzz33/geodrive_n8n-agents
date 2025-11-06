import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  // Проверяем события о сотрудниках/пользователях
  const employeeEvents = await sql`
    SELECT 
      event_name,
      entity_type,
      type,
      COUNT(*) as count
    FROM events
    WHERE 
      event_name ILIKE '%user%' 
      OR event_name ILIKE '%employee%'
      OR entity_type ILIKE '%user%'
      OR entity_type ILIKE '%employee%'
    GROUP BY event_name, entity_type, type
    ORDER BY count DESC
  `;
  
  console.log('Employee-related events in events table:');
  if (employeeEvents.length > 0) {
    employeeEvents.forEach(e => {
      console.log(`  ${e.event_name} | ${e.entity_type} | ${e.type} : ${e.count} records`);
    });
  } else {
    console.log('  No employee-related events found');
  }
  
  // Проверяем все типы событий
  console.log('\n\nAll event types:');
  const allTypes = await sql`
    SELECT DISTINCT event_name, entity_type, type
    FROM events
    ORDER BY event_name
    LIMIT 20
  `;
  
  allTypes.forEach(e => {
    console.log(`  ${e.event_name} | entity: ${e.entity_type} | type: ${e.type}`);
  });
  
  // Проверяем payload - может там есть данные о сотрудниках
  console.log('\n\nChecking payload for employee data (user_id, user_name fields):');
  const payloadCheck = await sql`
    SELECT 
      event_name,
      entity_type,
      jsonb_object_keys(payload) as key
    FROM events
    WHERE 
      payload ? 'user_id' 
      OR payload ? 'user_name'
      OR payload ? 'employee_id'
    LIMIT 5
  `;
  
  if (payloadCheck.length > 0) {
    console.log('Events with user/employee data in payload:');
    payloadCheck.forEach(e => {
      console.log(`  ${e.event_name} has field: ${e.key}`);
    });
  } else {
    console.log('No events with user/employee data in payload');
  }
  
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await sql.end();
}

