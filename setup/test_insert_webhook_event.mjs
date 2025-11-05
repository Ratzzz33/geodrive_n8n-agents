import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

console.log('\n🧪 Тестовая вставка события из вебхука...\n');

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  // Пример реального вебхука от RentProg
  const webhookData = {
    event: 'car_update',
    payload: {
      id: 38204,
      mileage: [101191, 102035],
      company_id: 9247,
      status: 'active',
      location: 'Tbilisi',
      updated_from_api: false
    }
  };
  
  console.log('📥 Входящий вебхук:');
  console.log(JSON.stringify(webhookData, null, 2));
  console.log('');
  
  // Вставляем событие
  console.log('💾 Сохранение в БД...\n');
  
  const result = await sql`
    INSERT INTO events (
      event_name,
      entity_type,
      operation,
      rentprog_id,
      company_id,
      payload,
      metadata,
      event_hash,
      processed
    )
    VALUES (
      ${webhookData.event},
      'car',
      'update',
      ${webhookData.payload.id.toString()},
      ${webhookData.payload.company_id},
      ${sql.json(webhookData.payload)},
      ${sql.json({
        source: 'test',
        received_at: new Date().toISOString(),
        test_run: true
      })},
      ${`test_${Date.now()}`},
      false
    )
    RETURNING *;
  `;
  
  console.log('✅ Событие сохранено!');
  console.log('═════════════════════════════════════════════════════════════════\n');
  
  const event = result[0];
  
  console.log(`ID: ${event.id}`);
  console.log(`Timestamp: ${event.ts.toISOString()}`);
  console.log(`Event Name: ${event.event_name}`);
  console.log(`Entity Type: ${event.entity_type}`);
  console.log(`Operation: ${event.operation}`);
  console.log(`RentProg ID: ${event.rentprog_id}`);
  console.log(`Company ID: ${event.company_id}`);
  console.log(`Processed: ${event.processed}`);
  console.log('\nPayload:');
  console.log(JSON.stringify(event.payload, null, 2));
  console.log('\nMetadata:');
  console.log(JSON.stringify(event.metadata, null, 2));
  console.log('\n═════════════════════════════════════════════════════════════════\n');
  
  // Проверяем, что можем найти по payload
  console.log('🔍 Тест поиска по payload...\n');
  
  const found = await sql`
    SELECT 
      id,
      event_name,
      rentprog_id,
      payload->'mileage' AS mileage_change
    FROM events
    WHERE payload @> '{"id": 38204}'::jsonb
    ORDER BY ts DESC
    LIMIT 1;
  `;
  
  if (found.length > 0) {
    console.log('✅ Поиск работает!');
    console.log(`   Найдено событие ID: ${found[0].id}`);
    console.log(`   Изменение пробега: ${found[0].mileage_change}`);
  } else {
    console.log('❌ Событие не найдено');
  }
  
  console.log('\n✅ Тест завершён успешно!\n');
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  console.error(error);
  process.exit(1);
} finally {
  await sql.end();
}

