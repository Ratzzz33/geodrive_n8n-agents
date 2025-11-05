import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    console.log('🗑️  Удаление тестовых событий из БД...\n');
    
    // Найдем тестовые записи
    const testEvents = await sql`
      SELECT id, ts, type, rentprog_id, company_id
      FROM events 
      WHERE rentprog_id IN ('99999', '12345', 'test', 'testwebhook')
         OR rentprog_id LIKE 'test%'
         OR (ts > '2025-11-03 18:00:00'::timestamp AND rentprog_id IN ('99999', '12345'))
      ORDER BY ts DESC
    `;
    
    console.log(`📊 Найдено тестовых событий: ${testEvents.length}`);
    
    if (testEvents.length > 0) {
      console.log('\nСписок тестовых событий:');
      testEvents.forEach((e, idx) => {
        console.log(`  ${idx + 1}. ID: ${e.id}, время: ${e.ts.toISOString()}, тип: ${e.type}, rentprog_id: ${e.rentprog_id}`);
      });
      
      // Удаляем
      const deleted = await sql`
        DELETE FROM events 
        WHERE rentprog_id IN ('99999', '12345', 'test', 'testwebhook')
           OR rentprog_id LIKE 'test%'
           OR (ts > '2025-11-03 18:00:00'::timestamp AND rentprog_id IN ('99999', '12345'))
      `;
      
      console.log(`\n✅ Удалено событий: ${deleted.length || testEvents.length}`);
    } else {
      console.log('⚠️  Тестовые события не найдены');
    }
    
    // Проверяем что осталось
    const remaining = await sql`
      SELECT COUNT(*) as cnt FROM events WHERE ts > NOW() - INTERVAL '1 hour'
    `;
    console.log(`\n📊 Осталось событий за последний час: ${remaining[0].cnt}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
})();

