/**
 * Проверка состояния Entity Timeline & Event Links
 * Проверяет наличие таблиц, количество записей, статистику и необходимость бэкфила
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkStatus() {
  console.log('🔍 Проверка состояния Entity Timeline & Event Links...\n');

  try {
    // 1. Проверка наличия таблиц
    console.log('📊 1. Проверка наличия таблиц:');
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('entity_timeline', 'event_links', 'events', 'payments', 'history')
      ORDER BY table_name
    `;
    
    const tableNames = tables.map(t => t.table_name);
    const requiredTables = ['entity_timeline', 'event_links', 'events', 'payments', 'history'];
    
    for (const table of requiredTables) {
      const exists = tableNames.includes(table);
      console.log(`   ${exists ? '✅' : '❌'} ${table}`);
    }
    
    if (!tableNames.includes('entity_timeline') || !tableNames.includes('event_links')) {
      console.log('\n⚠️  ВНИМАНИЕ: Отсутствуют необходимые таблицы!');
      return;
    }

    // 2. Количество записей в основных таблицах
    console.log('\n📈 2. Количество записей:');
    
    const counts = await sql`
      SELECT 
        (SELECT COUNT(*) FROM events) as events_count,
        (SELECT COUNT(*) FROM payments) as payments_count,
        (SELECT COUNT(*) FROM history) as history_count,
        (SELECT COUNT(*) FROM entity_timeline) as timeline_count,
        (SELECT COUNT(*) FROM event_links) as links_count
    `;
    
    const stats = counts[0];
    console.log(`   events:        ${stats.events_count.toLocaleString()}`);
    console.log(`   payments:      ${stats.payments_count.toLocaleString()}`);
    console.log(`   history:       ${stats.history_count.toLocaleString()}`);
    console.log(`   entity_timeline: ${stats.timeline_count.toLocaleString()}`);
    console.log(`   event_links:   ${stats.links_count.toLocaleString()}`);

    // 3. Статистика по источникам в entity_timeline
    console.log('\n📊 3. Статистика по источникам (entity_timeline):');
    const sourceStats = await sql`
      SELECT 
        source_type,
        entity_type,
        COUNT(*) as count,
        MIN(ts) as first_event,
        MAX(ts) as last_event
      FROM entity_timeline
      GROUP BY source_type, entity_type
      ORDER BY count DESC
    `;
    
    for (const stat of sourceStats) {
      console.log(`   ${stat.source_type} (${stat.entity_type}): ${stat.count.toLocaleString()} событий`);
      console.log(`      Первое: ${stat.first_event.toISOString().split('T')[0]}`);
      console.log(`      Последнее: ${stat.last_event.toISOString().split('T')[0]}`);
    }

    // 4. Статистика по типам связей в event_links
    console.log('\n🔗 4. Статистика по типам связей (event_links):');
    const linkStats = await sql`
      SELECT 
        link_type,
        confidence,
        matched_by,
        COUNT(*) as count
      FROM event_links
      GROUP BY link_type, confidence, matched_by
      ORDER BY count DESC
    `;
    
    if (linkStats.length === 0) {
      console.log('   ⚠️  Нет связей в event_links');
    } else {
      for (const stat of linkStats) {
        console.log(`   ${stat.link_type || 'N/A'} (${stat.confidence || 'N/A'}, ${stat.matched_by || 'N/A'}): ${stat.count}`);
      }
    }

    // 5. Проверка покрытия платежей в timeline
    console.log('\n💳 5. Покрытие платежей в timeline:');
    const paymentCoverage = await sql`
      SELECT 
        (SELECT COUNT(*) FROM payments) as total_payments,
        (SELECT COUNT(*) FROM entity_timeline WHERE entity_type = 'payment') as payments_in_timeline,
        (SELECT COUNT(*) FROM payments WHERE created_at > NOW() - INTERVAL '7 days') as recent_payments,
        (SELECT COUNT(*) FROM entity_timeline 
         WHERE entity_type = 'payment' AND ts > NOW() - INTERVAL '7 days') as recent_in_timeline
    `;
    
    const coverage = paymentCoverage[0];
    const coveragePercent = coverage.total_payments > 0 
      ? ((coverage.payments_in_timeline / coverage.total_payments) * 100).toFixed(1)
      : 0;
    
    console.log(`   Всего платежей: ${coverage.total_payments.toLocaleString()}`);
    console.log(`   В timeline: ${coverage.payments_in_timeline.toLocaleString()} (${coveragePercent}%)`);
    console.log(`   За последние 7 дней: ${coverage.recent_payments.toLocaleString()}`);
    console.log(`   В timeline за 7 дней: ${coverage.recent_in_timeline.toLocaleString()}`);

    // 6. Проверка обработанных событий
    console.log('\n✅ 6. Обработка событий:');
    const processedStats = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE processed = true) as processed,
        COUNT(*) FILTER (WHERE processed = false) as not_processed,
        COUNT(*) as total
      FROM events
    `;
    
    const processed = processedStats[0];
    const processedPercent = processed.total > 0 
      ? ((processed.processed / processed.total) * 100).toFixed(1)
      : 0;
    
    console.log(`   Обработано: ${processed.processed.toLocaleString()} (${processedPercent}%)`);
    console.log(`   Не обработано: ${processed.not_processed.toLocaleString()}`);

    // 7. Проверка несвязанных записей (через view если есть)
    console.log('\n🔍 7. Несвязанные записи (за последние 7 дней):');
    try {
      const unlinked = await sql`
        SELECT 
          source_table,
          COUNT(*) as count
        FROM unlinked_records
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY source_table
        ORDER BY count DESC
      `;
      
      if (unlinked.length === 0) {
        console.log('   ✅ Нет несвязанных записей');
      } else {
        for (const record of unlinked) {
          console.log(`   ${record.source_table}: ${record.count.toLocaleString()}`);
        }
      }
    } catch (error) {
      console.log('   ⚠️  View unlinked_records не существует или недоступна');
    }

    // 8. Проверка автоматического связывания (новые платежи)
    console.log('\n🤖 8. Автоматическое связывание (последние 7 дней):');
    const autoLinkStats = await sql`
      SELECT 
        COUNT(DISTINCT p.id) as new_payments,
        COUNT(DISTINCT el.payment_id) as linked_payments,
        COUNT(DISTINCT el.id) as links_created
      FROM payments p
      LEFT JOIN event_links el ON el.payment_id = p.id
      WHERE p.created_at > NOW() - INTERVAL '7 days'
    `;
    
    const autoLink = autoLinkStats[0];
    const linkPercent = autoLink.new_payments > 0
      ? ((autoLink.linked_payments / autoLink.new_payments) * 100).toFixed(1)
      : 0;
    
    console.log(`   Новых платежей: ${autoLink.new_payments.toLocaleString()}`);
    console.log(`   Связанных: ${autoLink.linked_payments.toLocaleString()} (${linkPercent}%)`);
    console.log(`   Создано связей: ${autoLink.links_created.toLocaleString()}`);

    // 9. Рекомендации по бэкфилу
    console.log('\n💡 9. Рекомендации:');
    
    const recommendations = [];
    
    // Проверка покрытия платежей
    if (coveragePercent < 90) {
      recommendations.push(`⚠️  Низкое покрытие платежей в timeline (${coveragePercent}%). Рекомендуется бэкфил.`);
    } else {
      console.log('   ✅ Покрытие платежей в timeline хорошее');
    }
    
    // Проверка необработанных событий
    if (processed.not_processed > 0) {
      recommendations.push(`⚠️  Есть необработанные события (${processed.not_processed}). Рекомендуется обработка.`);
    } else {
      console.log('   ✅ Все события обработаны');
    }
    
    // Проверка новых платежей без связей
    if (autoLink.new_payments > 0 && linkPercent < 50) {
      recommendations.push(`⚠️  Низкий процент связывания новых платежей (${linkPercent}%). Проверьте автоматическое связывание.`);
    } else if (autoLink.new_payments > 0) {
      console.log('   ✅ Автоматическое связывание работает');
    }
    
    if (recommendations.length > 0) {
      console.log('\n   Рекомендации:');
      for (const rec of recommendations) {
        console.log(`   ${rec}`);
      }
    } else {
      console.log('   ✅ Все системы работают нормально, бэкфил не требуется');
    }

    // 10. Итоговый статус
    console.log('\n📋 Итоговый статус:');
    const needsBackfill = coveragePercent < 90 || processed.not_processed > 0;
    
    if (needsBackfill) {
      console.log('   ⚠️  ТРЕБУЕТСЯ БЭКФИЛ');
      console.log('   - Низкое покрытие платежей в timeline');
      console.log('   - Или есть необработанные события');
    } else {
      console.log('   ✅ БЭКФИЛ НЕ ТРЕБУЕТСЯ');
      console.log('   - Покрытие платежей хорошее');
      console.log('   - Все события обработаны');
      console.log('   - Автоматическое связывание работает');
    }

  } catch (error) {
    console.error('❌ Ошибка при проверке:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

checkStatus().catch(console.error);

