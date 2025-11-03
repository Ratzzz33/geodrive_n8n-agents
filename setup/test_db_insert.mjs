// Тест прямой вставки в БД для проверки credentials
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('Тест прямой вставки в БД...\n');
  
  // Тестовая запись
  const testEvent = {
    branch: 'test_direct',
    type: 'test.insert',
    ext_id: `direct_test_${Date.now()}`,
    ok: true,
    reason: 'test'
  };
  
  const result = await sql`
    INSERT INTO events (ts, branch, type, ext_id, ok, reason, processed)
    VALUES (NOW(), ${testEvent.branch}, ${testEvent.type}, ${testEvent.ext_id}, ${testEvent.ok}, ${testEvent.reason}, FALSE)
    ON CONFLICT (branch, type, ext_id) DO NOTHING
    RETURNING id, ts, branch, type, ext_id
  `;
  
  if (result.length > 0) {
    console.log('✅ Запись успешно создана:');
    console.log(`   ID: ${result[0].id}`);
    console.log(`   Branch: ${result[0].branch}`);
    console.log(`   Type: ${result[0].type}`);
    console.log(`   Ext ID: ${result[0].ext_id}`);
    console.log(`   Время: ${result[0].ts}`);
  } else {
    console.log('⚠️ Запись не создана (возможно дубликат)');
  }
  
  // Проверка последних 3 записей
  const recent = await sql`
    SELECT id, ts, branch, type, ext_id, ok, processed
    FROM events
    ORDER BY ts DESC
    LIMIT 3
  `;
  
  console.log('\nПоследние 3 записи в БД:');
  recent.forEach(e => {
    console.log(`  ${e.id} | ${e.ts} | ${e.branch} | ${e.type} | ${e.ext_id} | ok:${e.ok} | processed:${e.processed}`);
  });
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  console.error('Детали:', error);
  process.exit(1);
} finally {
  await sql.end();
}
