/**
 * Проверка связей между events, history и payments
 */

import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('🔍 Анализ связей между events, history и payments\n');

  try {
    // 1. Общая статистика event_links
    console.log('📊 Общая статистика event_links:');
    const totalLinks = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(event_id) FILTER (WHERE event_id IS NOT NULL) as with_event,
        COUNT(history_id) FILTER (WHERE history_id IS NOT NULL) as with_history,
        COUNT(payment_id) FILTER (WHERE payment_id IS NOT NULL) as with_payment,
        COUNT(*) FILTER (WHERE event_id IS NOT NULL AND history_id IS NOT NULL) as event_and_history,
        COUNT(*) FILTER (WHERE event_id IS NOT NULL AND payment_id IS NOT NULL) as event_and_payment,
        COUNT(*) FILTER (WHERE history_id IS NOT NULL AND payment_id IS NOT NULL) as history_and_payment,
        COUNT(*) FILTER (WHERE event_id IS NOT NULL AND history_id IS NOT NULL AND payment_id IS NOT NULL) as all_three
      FROM event_links
    `;
    
    console.log(`  Всего связей: ${totalLinks[0].total}`);
    console.log(`  С event_id: ${totalLinks[0].with_event}`);
    console.log(`  С history_id: ${totalLinks[0].with_history}`);
    console.log(`  С payment_id: ${totalLinks[0].with_payment}`);
    console.log(`  Event + History: ${totalLinks[0].event_and_history}`);
    console.log(`  Event + Payment: ${totalLinks[0].event_and_payment}`);
    console.log(`  History + Payment: ${totalLinks[0].history_and_payment}`);
    console.log(`  Все три источника: ${totalLinks[0].all_three}\n`);

    // 2. Статистика по типам связей
    console.log('📊 Статистика по типам связей:');
    const linkTypes = await sql`
      SELECT 
        link_type,
        confidence,
        COUNT(*) as count,
        COUNT(event_id) FILTER (WHERE event_id IS NOT NULL) as has_event,
        COUNT(history_id) FILTER (WHERE history_id IS NOT NULL) as has_history,
        COUNT(payment_id) FILTER (WHERE payment_id IS NOT NULL) as has_payment
      FROM event_links
      GROUP BY link_type, confidence
      ORDER BY count DESC
    `;
    
    linkTypes.forEach(row => {
      console.log(`  ${row.link_type} (${row.confidence}): ${row.count} связей`);
      console.log(`    - event: ${row.has_event}, history: ${row.has_history}, payment: ${row.has_payment}`);
    });
    console.log();

    // 3. События без связей
    console.log('📊 События без связей (последние 7 дней):');
    const unlinkedEvents = await sql`
      SELECT COUNT(*) as count
      FROM events e
      WHERE NOT EXISTS (
        SELECT 1 FROM event_links el WHERE el.event_id = e.id
      )
      AND e.ts > NOW() - INTERVAL '7 days'
      AND e.processed = TRUE
    `;
    console.log(`  ${unlinkedEvents[0].count} несвязанных событий\n`);

    // 4. History без связей
    console.log('📊 History без связей (последние 7 дней):');
    const unlinkedHistory = await sql`
      SELECT COUNT(*) as count
      FROM history h
      WHERE NOT EXISTS (
        SELECT 1 FROM event_links el WHERE el.history_id = h.id
      )
      AND h.ts > NOW() - INTERVAL '7 days'
      AND h.processed = TRUE
    `;
    console.log(`  ${unlinkedHistory[0].count} несвязанных записей\n`);

    // 5. Примеры прямых связей event <-> history
    console.log('🔗 Примеры связей event <-> history (последние 10):');
    const eventHistoryLinks = await sql`
      SELECT 
        el.id,
        el.link_type,
        el.confidence,
        el.rp_entity_id,
        el.metadata,
        e.type as event_type,
        e.ts as event_time,
        h.operation_type,
        h.ts as history_time
      FROM event_links el
      LEFT JOIN events e ON e.id = el.event_id
      LEFT JOIN history h ON h.id = el.history_id
      WHERE el.event_id IS NOT NULL 
        AND el.history_id IS NOT NULL
      ORDER BY el.created_at DESC
      LIMIT 10
    `;
    
    if (eventHistoryLinks.length === 0) {
      console.log('  ⚠️  Нет прямых связей между events и history!\n');
    } else {
      eventHistoryLinks.forEach(link => {
        console.log(`  Link ${link.id}:`);
        console.log(`    - Event: ${link.event_type} @ ${link.event_time}`);
        console.log(`    - History: ${link.operation_type} @ ${link.history_time}`);
        console.log(`    - Confidence: ${link.confidence}, Type: ${link.link_type}`);
        console.log(`    - RentProg ID: ${link.rp_entity_id}\n`);
      });
    }

    // 6. Сколько events есть в history
    console.log('📊 Проверка: есть ли все events в history?');
    const eventsInHistory = await sql`
      SELECT 
        COUNT(DISTINCT e.id) as total_events,
        COUNT(DISTINCT CASE 
          WHEN EXISTS (
            SELECT 1 FROM history h 
            WHERE h.entity_id = e.rentprog_id 
              AND h.entity_type = e.entity_type
              AND ABS(EXTRACT(EPOCH FROM (h.ts - e.ts))) < 3600
          ) THEN e.id 
        END) as found_in_history
      FROM events e
      WHERE e.processed = TRUE
        AND e.ts > NOW() - INTERVAL '7 days'
    `;
    
    const coverage = eventsInHistory[0].found_in_history / eventsInHistory[0].total_events * 100;
    console.log(`  События за последние 7 дней: ${eventsInHistory[0].total_events}`);
    console.log(`  Найдено в history: ${eventsInHistory[0].found_in_history}`);
    console.log(`  Покрытие: ${coverage.toFixed(1)}%\n`);

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

main().catch(console.error);

