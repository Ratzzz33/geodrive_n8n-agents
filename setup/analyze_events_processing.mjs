#!/usr/bin/env node

/**
 * Analyze if workflow sxJo6Zs0ECMjRAFC is needed
 * Check if events are processed automatically via triggers
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function analyze() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Анализ: нужен ли workflow sxJo6Zs0ECMjRAFC?\n');

    // 1. Проверка триггера на events
    console.log('1️⃣ Проверка триггера на таблице events:\n');
    const triggers = await sql`
      SELECT 
        trigger_name,
        event_manipulation,
        action_timing
      FROM information_schema.triggers
      WHERE event_object_table = 'events'
        AND trigger_name LIKE '%auto_process%'
    `;

    if (triggers.length > 0) {
      console.log('✅ Триггеры автоматической обработки найдены:');
      triggers.forEach(trg => {
        console.log(`   - ${trg.trigger_name}: ${trg.action_timing} ${trg.event_manipulation}`);
      });
    } else {
      console.log('❌ Триггеры автоматической обработки НЕ найдены');
    }

    // 2. Статистика обработки
    console.log('\n2️⃣ Статистика обработки событий:\n');
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed = TRUE) as processed,
        COUNT(*) FILTER (WHERE processed = FALSE) as unprocessed,
        COUNT(*) FILTER (WHERE ts >= NOW() - INTERVAL '24 hours' AND processed = TRUE) as processed_24h,
        COUNT(*) FILTER (WHERE ts >= NOW() - INTERVAL '24 hours' AND processed = FALSE) as unprocessed_24h,
        AVG(EXTRACT(EPOCH FROM (NOW() - ts))) FILTER (WHERE processed = TRUE AND ts >= NOW() - INTERVAL '24 hours') as avg_processing_time_seconds
      FROM events
    `;

    const s = stats[0];
    console.log(`Всего событий: ${s.total}`);
    console.log(`Обработано: ${s.processed} (${((s.processed / s.total) * 100).toFixed(1)}%)`);
    console.log(`Не обработано: ${s.unprocessed}`);
    console.log(`Обработано за 24ч: ${s.processed_24h}`);
    console.log(`Не обработано за 24ч: ${s.unprocessed_24h}`);
    if (s.avg_processing_time_seconds) {
      console.log(`Среднее время обработки: ${parseFloat(s.avg_processing_time_seconds).toFixed(1)} секунд`);
    }

    // 3. Проверка последних событий
    console.log('\n3️⃣ Последние 10 событий (время обработки):\n');
    const recent = await sql`
      SELECT 
        id,
        ts,
        type,
        processed,
        ok,
        reason
      FROM events
      WHERE ts >= NOW() - INTERVAL '24 hours'
      ORDER BY ts DESC
      LIMIT 10
    `;

    recent.forEach((event, idx) => {
      const status = event.processed && event.ok ? '✅' 
                   : event.processed && !event.ok ? '❌' 
                   : '⏳';
      console.log(`  [${idx + 1}] ${status} ID: ${event.id} | ${event.ts.toISOString()} | ${event.type || 'NULL'}`);
      if (event.reason) {
        console.log(`      Причина: ${event.reason.substring(0, 60)}...`);
      }
    });

    // 4. Вывод
    console.log('\n' + '═'.repeat(60));
    console.log('📊 ВЫВОД:\n');

    if (triggers.length > 0 && parseInt(s.unprocessed) === 0 && parseInt(s.unprocessed_24h) === 0) {
      console.log('✅ Workflow sxJo6Zs0ECMjRAFC НЕ НУЖЕН!');
      console.log('\nПричины:');
      console.log('   1. Триггеры БД автоматически обрабатывают события');
      console.log('   2. Все события обработаны (processed = true)');
      console.log('   3. Нет необработанных событий за 24 часа');
      console.log('   4. Обработка происходит мгновенно через триггеры + eventProcessor');
      console.log('\n💡 Рекомендация:');
      console.log('   - ДЕАКТИВИРОВАТЬ workflow sxJo6Zs0ECMjRAFC');
      console.log('   - Или оставить как FALLBACK на случай проблем с триггерами');
    } else if (parseInt(s.unprocessed) > 0) {
      console.log('⚠️ Workflow sxJo6Zs0ECMjRAFC МОЖЕТ БЫТЬ ПОЛЕЗЕН');
      console.log('\nПричины:');
      console.log('   - Есть необработанные события');
      console.log('   - Может быть проблема с триггерами или eventProcessor');
      console.log('\n💡 Рекомендация:');
      console.log('   - Проверить работу триггеров');
      console.log('   - Проверить запущен ли eventProcessor в Jarvis API');
      console.log('   - Оставить workflow как FALLBACK');
    } else {
      console.log('✅ Workflow sxJo6Zs0ECMjRAFC НЕ НУЖЕН');
      console.log('   - Все события обрабатываются автоматически');
    }

    // 5. Сравнение с history
    console.log('\n4️⃣ Сравнение обработки events vs history:\n');
    const comparison = await sql`
      SELECT 
        (SELECT COUNT(*) FROM events WHERE processed = FALSE) as events_unprocessed,
        (SELECT COUNT(*) FROM history WHERE processed = FALSE) as history_unprocessed,
        (SELECT COUNT(*) FROM events WHERE ts >= NOW() - INTERVAL '24 hours') as events_24h,
        (SELECT COUNT(*) FROM history WHERE created_at >= NOW() - INTERVAL '24 hours') as history_24h
    `;

    const c = comparison[0];
    console.log(`events необработано: ${c.events_unprocessed}`);
    console.log(`history необработано: ${c.history_unprocessed}`);
    console.log(`events за 24ч: ${c.events_24h}`);
    console.log(`history за 24ч: ${c.history_24h}`);

    if (parseInt(c.events_unprocessed) === 0 && parseInt(c.history_unprocessed) > 0) {
      console.log('\n💡 Основной поток данных:');
      console.log('   - events: обрабатываются автоматически (триггеры) ✅');
      console.log('   - history: обрабатываются автоматически (триггеры) ✅');
      console.log('   - Оба потока работают независимо');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

analyze().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

