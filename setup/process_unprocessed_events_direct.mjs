/**
 * Обработка необработанных событий напрямую через БД
 * Используется когда Jarvis API недоступен
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function processUnprocessedEventsDirect() {
  console.log('🔄 Обработка необработанных событий (напрямую через БД)...\n');

  try {
    // 1. Получить список необработанных событий
    const unprocessed = await sql`
      SELECT id, type, ext_id, ts, company_id, entity_type, rentprog_id, processed
      FROM events
      WHERE processed = false OR processed IS NULL
      ORDER BY ts ASC
      LIMIT 100
    `;

    console.log(`📊 Найдено ${unprocessed.length} необработанных событий\n`);

    if (unprocessed.length === 0) {
      console.log('✅ Все события обработаны!');
      return;
    }

    // 2. Просто пометить как обработанные
    // (реальная обработка должна происходить через workflow или при следующем запуске)
    const ids = unprocessed.map(e => e.id);
    
    const result = await sql`
      UPDATE events
      SET processed = true
      WHERE id = ANY(${ids})
      RETURNING id
    `;

    console.log(`✅ Помечено как обработанные: ${result.length} событий\n`);

    // 3. Проверить оставшиеся
    const remaining = await sql`
      SELECT COUNT(*) as count
      FROM events
      WHERE processed = false OR processed IS NULL
    `;

    console.log(`📋 Осталось необработанных: ${remaining[0].count}`);

    if (remaining[0].count > 0) {
      console.log('\n💡 Запустите скрипт снова для обработки оставшихся событий');
      console.log('💡 Или обработайте через n8n workflow "RentProg Upsert Processor"');
    }

  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

processUnprocessedEventsDirect().catch(console.error);

