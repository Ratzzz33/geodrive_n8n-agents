#!/usr/bin/env node

/**
 * Check if events table is still being used and if workflow sxJo6Zs0ECMjRAFC is needed
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkEventsTable() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Проверка использования таблицы events...\n');

    // 1. Статистика по таблице events
    console.log('1️⃣ Статистика таблицы events:\n');
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed = FALSE) as unprocessed,
        COUNT(*) FILTER (WHERE processed = TRUE) as processed,
        COUNT(*) FILTER (WHERE ts >= NOW() - INTERVAL '24 hours') as last_24h,
        COUNT(*) FILTER (WHERE ts >= NOW() - INTERVAL '7 days') as last_7d,
        MIN(ts) as oldest,
        MAX(ts) as newest
      FROM events
    `;

    const s = stats[0];
    console.log(`Всего записей: ${s.total}`);
    console.log(`Обработано: ${s.processed}`);
    console.log(`Не обработано: ${s.unprocessed}`);
    console.log(`За 24 часа: ${s.last_24h}`);
    console.log(`За 7 дней: ${s.last_7d}`);
    console.log(`Самая старая: ${s.oldest ? s.oldest.toISOString() : 'NULL'}`);
    console.log(`Самая новая: ${s.newest ? s.newest.toISOString() : 'NULL'}`);

    // 2. Последние необработанные события
    console.log('\n2️⃣ Последние необработанные события:\n');
    const unprocessed = await sql`
      SELECT 
        id,
        ts,
        type,
        event_name,
        entity_type,
        rentprog_id,
        ext_id
      FROM events
      WHERE processed = FALSE
      ORDER BY ts DESC
      LIMIT 10
    `;

    if (unprocessed.length > 0) {
      console.log(`Найдено необработанных: ${unprocessed.length}`);
      unprocessed.forEach((event, idx) => {
        console.log(`\n  [${idx + 1}] ID: ${event.id}`);
        console.log(`      Время: ${event.ts.toISOString()}`);
        console.log(`      Тип: ${event.type || event.event_name || 'NULL'}`);
        console.log(`      Entity: ${event.entity_type || 'NULL'} / ${event.rentprog_id || event.ext_id || 'NULL'}`);
      });
    } else {
      console.log('✅ Все события обработаны');
    }

    // 3. Сравнение с таблицей history
    console.log('\n3️⃣ Сравнение events vs history:\n');
    const comparison = await sql`
      SELECT 
        (SELECT COUNT(*) FROM events WHERE ts >= NOW() - INTERVAL '24 hours') as events_24h,
        (SELECT COUNT(*) FROM history WHERE created_at >= NOW() - INTERVAL '24 hours') as history_24h,
        (SELECT COUNT(*) FROM events WHERE processed = FALSE) as events_unprocessed,
        (SELECT COUNT(*) FROM history WHERE processed = FALSE) as history_unprocessed
    `;

    const c = comparison[0];
    console.log(`events за 24ч: ${c.events_24h}`);
    console.log(`history за 24ч: ${c.history_24h}`);
    console.log(`events необработано: ${c.events_unprocessed}`);
    console.log(`history необработано: ${c.history_unprocessed}`);

    // 4. Рекомендация
    console.log('\n' + '═'.repeat(60));
    console.log('📊 РЕКОМЕНДАЦИЯ:\n');

    if (parseInt(c.events_24h) === 0 && parseInt(c.events_unprocessed) === 0) {
      console.log('✅ Таблица events НЕ используется активно');
      console.log('   - Нет новых событий за 24 часа');
      console.log('   - Все события обработаны');
      console.log('   - Workflow sxJo6Zs0ECMjRAFC можно ДЕАКТИВИРОВАТЬ или УДАЛИТЬ');
    } else if (parseInt(c.events_24h) > 0) {
      console.log('⚠️ Таблица events ВСЕ ЕЩЕ используется');
      console.log('   - Есть новые события за 24 часа');
      console.log('   - Workflow sxJo6Zs0ECMjRAFC НУЖЕН для обработки');
    } else if (parseInt(c.events_unprocessed) > 0) {
      console.log('⚠️ Есть необработанные события');
      console.log('   - Нужно обработать перед деактивацией workflow');
      console.log('   - Workflow sxJo6Zs0ECMjRAFC нужен для обработки старых событий');
    }

    if (parseInt(c.history_24h) > parseInt(c.events_24h)) {
      console.log('\n💡 Основной поток данных идет через history таблицу');
      console.log('   - history используется активнее, чем events');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

checkEventsTable().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

