import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    console.log('Получаю последний вебхук из БД...\n');

    // Получить последнее событие с полным payload
    const lastEvent = await sql`
      SELECT
        id,
        event_name,
        entity_type,
        operation,
        rentprog_id,
        company_id,
        payload,
        metadata,
        execution_id,
        execution_url,
        ts
      FROM events
      ORDER BY ts DESC
      LIMIT 1
    `;

    if (lastEvent.length === 0) {
      console.log('❌ Нет событий в базе');
      process.exit(1);
    }

    const event = lastEvent[0];

    console.log('=== Последний вебхук ===\n');
    console.log('ID события:', event.id);
    console.log('Время:', event.ts);
    console.log('Название события:', event.event_name);
    console.log('Тип сущности:', event.entity_type);
    console.log('Операция:', event.operation);
    console.log('RentProg ID:', event.rentprog_id);
    console.log('Company ID:', event.company_id);
    console.log('Execution ID:', event.execution_id);
    console.log('Execution URL:', event.execution_url);
    
    console.log('\n=== Payload (данные из RentProg) ===\n');
    console.log(JSON.stringify(event.payload, null, 2));
    
    console.log('\n=== Metadata ===\n');
    console.log(JSON.stringify(event.metadata, null, 2));

    console.log('\n=== Полный JSON для копирования ===\n');
    console.log(JSON.stringify({
      event: event.event_name,
      payload: JSON.stringify(event.payload)
    }, null, 2));

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
    process.exit();
  }
})();
