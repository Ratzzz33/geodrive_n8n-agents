import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

console.log('\n🔍 Проверка результата тестового вебхука...\n');

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  // 1. Проверка в events
  console.log('1️⃣ Проверка в таблице events...\n');
  
  const events = await sql`
    SELECT 
      id, ts, event_name, entity_type, operation,
      rentprog_id, company_id, processed
    FROM events
    WHERE company_id = 11163
    ORDER BY ts DESC
    LIMIT 1;
  `;
  
  if (events.length > 0) {
    const event = events[0];
    console.log('✅ Событие найдено:');
    console.log(`   ID: ${event.id}`);
    console.log(`   Timestamp: ${event.ts.toISOString()}`);
    console.log(`   Event: ${event.event_name}`);
    console.log(`   Entity Type: ${event.entity_type}`);
    console.log(`   Operation: ${event.operation}`);
    console.log(`   RentProg ID: ${event.rentprog_id}`);
    console.log(`   Company ID: ${event.company_id}`);
    console.log(`   Processed: ${event.processed}`);
    console.log('');
  } else {
    console.log('❌ События не найдены\n');
  }
  
  // 2. Проверка в external_refs
  console.log('2️⃣ Проверка в таблице external_refs...\n');
  
  const refs = await sql`
    SELECT 
      entity_id, entity_type, system, external_id, created_at
    FROM external_refs
    WHERE system = 'rentprog'
      AND external_id = '999999'
    LIMIT 1;
  `;
  
  if (refs.length > 0) {
    const ref = refs[0];
    console.log('✅ Запись создана:');
    console.log(`   Entity ID (UUID): ${ref.entity_id}`);
    console.log(`   Entity Type: ${ref.entity_type}`);
    console.log(`   System: ${ref.system}`);
    console.log(`   External ID: ${ref.external_id}`);
    console.log(`   Created: ${ref.created_at.toISOString()}`);
    console.log('');
  } else {
    console.log('❌ Запись в external_refs не найдена\n');
  }
  
  // 3. Получаем полные данные
  if (refs.length > 0) {
    console.log('3️⃣ Полные данные записи...\n');
    
    const fullData = await sql`
      SELECT data
      FROM external_refs
      WHERE entity_id = ${refs[0].entity_id};
    `;
    
    if (fullData.length > 0 && fullData[0].data) {
      console.log('📦 Payload (JSON):');
      console.log(JSON.stringify(fullData[0].data, null, 2));
      console.log('');
    }
  }
  
  console.log('✅ Проверка завершена!\n');
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  console.error(error);
} finally {
  await sql.end();
}


