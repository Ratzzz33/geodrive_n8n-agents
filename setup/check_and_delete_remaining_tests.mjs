import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    console.log('🔍 Проверка событий после 18:00 (возможные тесты)...\n');
    
    // Проверяем все события после 18:00
    const recent = await sql`
      SELECT id, ts, type, rentprog_id, company_id
      FROM events 
      WHERE ts > '2025-11-03 18:00:00'::timestamp
      ORDER BY ts DESC
    `;
    
    console.log(`Найдено событий после 18:00: ${recent.length}\n`);
    
    if (recent.length > 0) {
      console.log('Список событий:');
      recent.forEach((e, idx) => {
        console.log(`  ${idx + 1}. ID:${e.id} ${e.ts.toISOString()} type:${e.type} rentprog_id:${e.rentprog_id} company:${e.company_id}`);
      });
      
      // Удаляем тестовые по времени (18:55 и 19:14 - это точно наши тесты)
      const testIds = recent
        .filter(e => {
          const hour = e.ts.getUTCHours();
          const minute = e.ts.getUTCMinutes();
          // 18:55 и 19:14 - это наши тесты
          return (hour === 18 && minute >= 55) || (hour === 19 && minute >= 14);
        })
        .map(e => e.id);
      
      if (testIds.length > 0) {
        console.log(`\n🗑️  Удаление тестовых событий (ID: ${testIds.join(', ')})...`);
        const deleted = await sql`
          DELETE FROM events WHERE id = ANY(${testIds})
        `;
        console.log(`✅ Удалено: ${testIds.length} событий`);
      } else {
        console.log('\n⚠️  Не найдено явно тестовых событий по времени');
      }
    }
    
    // Финальная проверка
    const final = await sql`
      SELECT COUNT(*) as cnt FROM events WHERE ts > '2025-11-03 18:00:00'::timestamp
    `;
    console.log(`\n📊 Осталось событий после 18:00: ${final[0].cnt}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
})();

