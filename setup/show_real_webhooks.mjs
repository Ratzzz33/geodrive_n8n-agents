import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    console.log('=== Реальные вебхуки (не тестовые) ===\n');

    const realEvents = await sql`
      SELECT
        id,
        event_name,
        entity_type,
        operation,
        rentprog_id,
        company_id,
        payload,
        metadata,
        execution_url,
        ts
      FROM events
      WHERE rentprog_id != '99999'
      ORDER BY ts DESC
      LIMIT 3
    `;

    realEvents.forEach((event, index) => {
      console.log(`${index + 1}. Event #${event.id}`);
      console.log(`   Event: ${event.event_name}`);
      console.log(`   Type: ${event.entity_type} | Operation: ${event.operation}`);
      console.log(`   RentProg ID: ${event.rentprog_id}`);
      console.log(`   Company ID: ${event.company_id}`);
      console.log(`   Time: ${event.ts}`);
      console.log(`   Execution URL: ${event.execution_url || 'NOT SET'}`);
      console.log(`   Branch: ${event.metadata?.branch || 'unknown'}`);
      console.log(`\n   Payload:`);
      console.log(JSON.stringify(event.payload, null, 2));
      console.log(`\n   --- Webhook для копирования ---`);
      console.log(JSON.stringify({
        event: event.event_name,
        payload: JSON.stringify(event.payload)
      }, null, 2));
      console.log('\n' + '='.repeat(80) + '\n');
    });

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
    process.exit();
  }
})();

