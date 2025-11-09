/**
 * Проверка содержимого таблиц events, history, payments
 */

import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('🔍 Проверка содержимого таблиц\n');

  try {
    // 1. Events
    console.log('📊 Таблица events:');
    const eventsStats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed = TRUE) as processed,
        COUNT(*) FILTER (WHERE processed = FALSE) as unprocessed,
        MIN(ts) as oldest,
        MAX(ts) as newest,
        COUNT(DISTINCT entity_type) as entity_types
      FROM events
    `;
    
    console.log(`  Всего записей: ${eventsStats[0].total}`);
    console.log(`  Обработано: ${eventsStats[0].processed}`);
    console.log(`  Не обработано: ${eventsStats[0].unprocessed}`);
    console.log(`  Старейшее: ${eventsStats[0].oldest}`);
    console.log(`  Новейшее: ${eventsStats[0].newest}`);
    console.log(`  Типов сущностей: ${eventsStats[0].entity_types}\n`);

    // По типам
    if (eventsStats[0].total > 0) {
      const eventTypes = await sql`
        SELECT entity_type, COUNT(*) as count
        FROM events
        GROUP BY entity_type
        ORDER BY count DESC
        LIMIT 10
      `;
      console.log('  По типам сущностей:');
      eventTypes.forEach(row => {
        console.log(`    - ${row.entity_type}: ${row.count}`);
      });
      console.log();
    }

    // 2. History
    console.log('📊 Таблица history:');
    const historyStats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed = TRUE) as processed,
        COUNT(*) FILTER (WHERE processed = FALSE) as unprocessed,
        MIN(ts) as oldest,
        MAX(ts) as newest,
        COUNT(DISTINCT entity_type) as entity_types,
        COUNT(DISTINCT branch) as branches
      FROM history
    `;
    
    console.log(`  Всего записей: ${historyStats[0].total}`);
    console.log(`  Обработано: ${historyStats[0].processed}`);
    console.log(`  Не обработано: ${historyStats[0].unprocessed}`);
    console.log(`  Старейшее: ${historyStats[0].oldest}`);
    console.log(`  Новейшее: ${historyStats[0].newest}`);
    console.log(`  Типов сущностей: ${historyStats[0].entity_types}`);
    console.log(`  Филиалов: ${historyStats[0].branches}\n`);

    // По типам
    if (historyStats[0].total > 0) {
      const historyTypes = await sql`
        SELECT entity_type, operation_type, COUNT(*) as count
        FROM history
        GROUP BY entity_type, operation_type
        ORDER BY count DESC
        LIMIT 10
      `;
      console.log('  По типам операций:');
      historyTypes.forEach(row => {
        console.log(`    - ${row.entity_type}.${row.operation_type}: ${row.count}`);
      });
      console.log();
    }

    // 3. Payments
    console.log('📊 Таблица payments:');
    const paymentsStats = await sql`
      SELECT 
        COUNT(*) as total,
        MIN(payment_date) as oldest,
        MAX(payment_date) as newest,
        COUNT(DISTINCT branch) as branches,
        SUM(amount::numeric) as total_amount
      FROM payments
    `;
    
    console.log(`  Всего записей: ${paymentsStats[0].total}`);
    console.log(`  Старейший: ${paymentsStats[0].oldest}`);
    console.log(`  Новейший: ${paymentsStats[0].newest}`);
    console.log(`  Филиалов: ${paymentsStats[0].branches}`);
    console.log(`  Общая сумма: ${paymentsStats[0].total_amount}\n`);

    // 4. Entity Timeline
    console.log('📊 Таблица entity_timeline:');
    const timelineStats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT entity_type) as entity_types,
        COUNT(DISTINCT source_type) as source_types,
        MIN(ts) as oldest,
        MAX(ts) as newest
      FROM entity_timeline
    `;
    
    console.log(`  Всего записей: ${timelineStats[0].total}`);
    console.log(`  Типов сущностей: ${timelineStats[0].entity_types}`);
    console.log(`  Типов источников: ${timelineStats[0].source_types}`);
    console.log(`  Старейшее: ${timelineStats[0].oldest}`);
    console.log(`  Новейшее: ${timelineStats[0].newest}\n`);

    // По типам источников
    if (timelineStats[0].total > 0) {
      const sourceTypes = await sql`
        SELECT source_type, entity_type, COUNT(*) as count
        FROM entity_timeline
        GROUP BY source_type, entity_type
        ORDER BY count DESC
      `;
      console.log('  По типам источников:');
      sourceTypes.forEach(row => {
        console.log(`    - ${row.source_type} (${row.entity_type}): ${row.count}`);
      });
      console.log();
    }

    // 5. Резюме
    console.log('📋 Резюме:');
    console.log(`  ✅ Events: ${eventsStats[0].total > 0 ? eventsStats[0].total + ' записей' : '❌ Пусто'}`);
    console.log(`  ✅ History: ${historyStats[0].total > 0 ? historyStats[0].total + ' записей' : '❌ Пусто'}`);
    console.log(`  ✅ Payments: ${paymentsStats[0].total > 0 ? paymentsStats[0].total + ' записей' : '❌ Пусто'}`);
    console.log(`  ✅ Entity Timeline: ${timelineStats[0].total > 0 ? timelineStats[0].total + ' записей' : '❌ Пусто'}`);
    console.log(`  ❓ Event Links: ${0} записей (не создаются автоматически)\n`);

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

main().catch(console.error);

