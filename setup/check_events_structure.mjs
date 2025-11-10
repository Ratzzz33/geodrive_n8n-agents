/**
 * Проверка структуры таблицы events и причин отсутствия связывания
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkEventsStructure() {
  console.log('🔍 Проверка структуры таблицы events...\n');

  try {
    // 1. Структура таблицы
    console.log('📊 1. Структура таблицы events:');
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'events'
      ORDER BY ordinal_position
    `;
    
    for (const col of columns) {
      console.log(`   ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    }

    // 2. Проверка наличия полей для связывания
    console.log('\n🔍 2. Проверка полей для связывания:');
    const hasEntityType = columns.some(c => c.column_name === 'entity_type');
    const hasRentprogId = columns.some(c => c.column_name === 'rentprog_id');
    const hasCompanyId = columns.some(c => c.column_name === 'company_id');
    
    console.log(`   entity_type: ${hasEntityType ? '✅' : '❌'}`);
    console.log(`   rentprog_id: ${hasRentprogId ? '✅' : '❌'}`);
    console.log(`   company_id: ${hasCompanyId ? '✅' : '❌'}`);

    // 3. Примеры записей
    console.log('\n📋 3. Примеры записей (первые 5):');
    const samples = await sql`
      SELECT id, type, ext_id, entity_type, rentprog_id, company_id, ts, ok, processed
      FROM events
      ORDER BY ts DESC
      LIMIT 5
    `;
    
    for (const sample of samples) {
      console.log(`   ID: ${sample.id}, Type: ${sample.type}, Entity Type: ${sample.entity_type || 'N/A'}, Ext ID: ${sample.ext_id || 'N/A'}, RentProg ID: ${sample.rentprog_id || 'N/A'}, Processed: ${sample.processed}`);
    }

    // 4. Проверка типов событий
    console.log('\n📊 4. Распределение по типам событий:');
    const typeStats = await sql`
      SELECT type, COUNT(*) as count
      FROM events
      WHERE type IS NOT NULL
      GROUP BY type
      ORDER BY count DESC
    `;
    
    for (const stat of typeStats) {
      console.log(`   ${stat.type}: ${stat.count.toLocaleString()}`);
    }

    // 5. Проверка событий о платежах
    console.log('\n💳 5. События о платежах:');
    const paymentEventsByType = await sql`
      SELECT COUNT(*) as count
      FROM events
      WHERE type LIKE '%payment%' OR type LIKE '%count%'
    `;
    
    const paymentEventsByEntity = await sql`
      SELECT COUNT(*) as count
      FROM events
      WHERE entity_type = 'payment'
    `;
    
    console.log(`   Событий с payment/count в типе: ${paymentEventsByType[0].count}`);
    console.log(`   Событий с entity_type = 'payment': ${paymentEventsByEntity[0].count}`);

    // 6. Сравнение с payments
    console.log('\n🔗 6. Сравнение с таблицей payments:');
    const comparison = await sql`
      SELECT 
        (SELECT COUNT(*) FROM events) as events_count,
        (SELECT COUNT(*) FROM payments) as payments_count,
        (SELECT COUNT(DISTINCT branch) FROM events) as events_branches,
        (SELECT COUNT(DISTINCT branch_id) FROM payments) as payments_branches
    `;
    
    const comp = comparison[0];
    console.log(`   Events: ${comp.events_count.toLocaleString()} (${comp.events_branches} филиалов)`);
    console.log(`   Payments: ${comp.payments_count.toLocaleString()} (${comp.payments_branches} филиалов)`);

    // 7. Проверка временного окна для связывания
    console.log('\n⏰ 7. Анализ временных окон для связывания:');
    const timeWindow = await sql`
      SELECT 
        p.id as payment_id,
        p.payment_date,
        p.raw_data->>'id' as rp_payment_id,
        b.code as branch_code,
        e.id as event_id,
        e.ts as event_ts,
        e.entity_type as event_entity_type,
        e.rentprog_id as event_rentprog_id,
        e.ext_id as event_ext_id,
        ABS(EXTRACT(EPOCH FROM (e.ts - p.payment_date))) as time_diff_seconds
      FROM payments p
      JOIN branches b ON b.id = p.branch_id
      LEFT JOIN events e ON 
        (
          e.rentprog_id = p.raw_data->>'id'
          OR e.ext_id = p.raw_data->>'id'
        )
        AND e.company_id = (
          CASE b.code
            WHEN 'tbilisi' THEN 9247
            WHEN 'batumi' THEN 9248
            WHEN 'kutaisi' THEN 9506
            WHEN 'service-center' THEN 11163
            ELSE NULL
          END
        )
        AND ABS(EXTRACT(EPOCH FROM (e.ts - p.payment_date))) < 300
      WHERE p.created_at > NOW() - INTERVAL '7 days'
      ORDER BY time_diff_seconds NULLS LAST
      LIMIT 10
    `;
    
    if (timeWindow.length === 0 || timeWindow.every(r => !r.event_id)) {
      console.log('   ⚠️  Нет совпадений в окне ±5 минут');
    } else {
      const matches = timeWindow.filter(r => r.event_id);
      console.log(`   Найдено ${matches.length} потенциальных связей:`);
      for (const row of matches.slice(0, 5)) {
        console.log(`     Payment ${row.payment_id} (RP: ${row.rp_payment_id}): ${row.time_diff_seconds?.toFixed(0) || 'N/A'} сек от event ${row.event_id} (entity_type: ${row.event_entity_type || 'N/A'})`);
      }
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

checkEventsStructure().catch(console.error);

