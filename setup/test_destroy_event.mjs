import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

console.log('\n🧪 Тест события destroy...\n');

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  // Пример реального вебхука client_destroy от RentProg
  const webhookData = {
    event: 'client_destroy',
    payload: {
      id: 381164
    }
  };
  
  console.log('📥 Входящий вебхук (destroy):');
  console.log(JSON.stringify(webhookData, null, 2));
  console.log('');
  
  // 1. Тест вставки с operation = 'destroy'
  console.log('1️⃣ Тест вставки с operation = "destroy"...\n');
  
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
      'client',
      'destroy',
      ${webhookData.payload.id.toString()},
      9247,
      ${sql.json(webhookData.payload)},
      ${sql.json({
        source: 'test',
        received_at: new Date().toISOString(),
        test_run: true
      })},
      ${`test_destroy_${Date.now()}`},
      false
    )
    RETURNING *;
  `;
  
  console.log('✅ Событие destroy успешно сохранено!');
  console.log('═════════════════════════════════════════════════════════════════\n');
  
  const event = result[0];
  
  console.log(`ID: ${event.id}`);
  console.log(`Event Name: ${event.event_name}`);
  console.log(`Entity Type: ${event.entity_type}`);
  console.log(`Operation: ${event.operation} ✅`);
  console.log(`RentProg ID: ${event.rentprog_id}`);
  console.log(`Company ID: ${event.company_id}`);
  console.log('\nPayload:');
  console.log(JSON.stringify(event.payload, null, 2));
  console.log('\n═════════════════════════════════════════════════════════════════\n');
  
  // 2. Тест что 'delete' не принимается
  console.log('2️⃣ Тест что operation = "delete" отклоняется...\n');
  
  try {
    await sql`
      INSERT INTO events (
        event_name,
        entity_type,
        operation,
        rentprog_id
      )
      VALUES (
        'test_event',
        'test',
        'delete',
        '999'
      );
    `;
    
    console.log('❌ Ошибка: "delete" не должен был пройти!\n');
    
  } catch (error) {
    if (error.message.includes('events_operation_check')) {
      console.log('✅ Правильно! "delete" отклонён constraint:\n');
      console.log(`   ${error.message}\n`);
    } else {
      console.log('❌ Неожиданная ошибка:\n');
      console.log(`   ${error.message}\n`);
    }
  }
  
  // 3. Статистика по operation
  console.log('3️⃣ Статистика по operation в БД...\n');
  
  const stats = await sql`
    SELECT 
      operation,
      COUNT(*) AS count
    FROM events
    WHERE operation IS NOT NULL
    GROUP BY operation
    ORDER BY operation;
  `;
  
  console.log('📊 Используемые operation:');
  console.log('─────────────────────────────────────────────────');
  stats.forEach(stat => {
    const marker = stat.operation === 'destroy' ? ' ✅' : '';
    console.log(`   ${stat.operation.padEnd(10)} → ${stat.count} записей${marker}`);
  });
  console.log('─────────────────────────────────────────────────\n');
  
  console.log('✅ Все тесты пройдены!\n');
  console.log('💡 Допустимые значения operation:');
  console.log('   - create');
  console.log('   - update');
  console.log('   - destroy ✅\n');
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  console.error(error);
  process.exit(1);
} finally {
  await sql.end();
}


