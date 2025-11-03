// Проверка типов событий в БД
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('📊 Анализ типов событий в БД...\n');
  
  // Группировка по типам
  const result = await sql`
    SELECT type, branch, COUNT(*) as cnt 
    FROM events 
    GROUP BY type, branch 
    ORDER BY cnt DESC
  `;
  
  if (result.length > 0) {
    console.log('Типы событий:');
    result.forEach(r => {
      console.log(`   ${r.type} (${r.branch}): ${r.cnt}`);
    });
    
    // Проверить есть ли реальные события от RentProg
    const realEvents = result.filter(r => 
      !r.type.includes('test') && 
      !r.type.includes('diagnostic') &&
      (r.type.includes('booking') || r.type.includes('car') || r.type.includes('payment'))
    );
    
    console.log('\n📋 Анализ:');
    if (realEvents.length > 0) {
      console.log(`   ✅ Найдено ${realEvents.length} типов реальных событий от RentProg`);
    } else {
      console.log('   ⚠️  Реальных событий от RentProg не найдено');
      console.log('   Все события - тестовые');
    }
  } else {
    console.log('   Событий в БД нет');
  }
  
  // Последние 10 событий
  console.log('\n📝 Последние 10 событий:');
  const recent = await sql`
    SELECT id, ts, branch, type, ext_id, ok, processed
    FROM events
    ORDER BY ts DESC
    LIMIT 10
  `;
  
  recent.forEach(e => {
    const date = new Date(e.ts).toLocaleString('ru-RU');
    console.log(`   ${date} - ${e.type} (${e.branch}) - ID: ${e.ext_id} - OK: ${e.ok}`);
  });
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
} finally {
  await sql.end();
}

