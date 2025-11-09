/**
 * Анализ events - проверка структуры и типов
 */

import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('🔍 Анализ events\n');

  try {
    // 1. Примеры записей
    console.log('📊 Примеры events:');
    const samples = await sql`
      SELECT 
        id, 
        type, 
        entity_type, 
        rentprog_id, 
        ext_id,
        company_id,
        ts,
        processed,
        payload
      FROM events
      WHERE entity_type IS NOT NULL
      ORDER BY ts DESC
      LIMIT 3
    `;
    
    samples.forEach((event, i) => {
      console.log(`\nСобытие ${i + 1}:`);
      console.log(`  ID: ${event.id}`);
      console.log(`  Type: ${event.type}`);
      console.log(`  Entity Type: ${event.entity_type}`);
      console.log(`  RentProg ID: ${event.rentprog_id}`);
      console.log(`  Ext ID: ${event.ext_id}`);
      console.log(`  Company ID: ${event.company_id}`);
      console.log(`  Timestamp: ${event.ts}`);
      console.log(`  Processed: ${event.processed}`);
      console.log(`  Payload:`, JSON.stringify(event.payload, null, 2).substring(0, 300));
    });
    console.log();

    // 2. Статистика по типам
    console.log('📊 Типы событий:');
    const types = await sql`
      SELECT 
        type,
        entity_type,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE processed = TRUE) as processed_count
      FROM events
      GROUP BY type, entity_type
      ORDER BY count DESC
    `;
    
    types.forEach(row => {
      console.log(`  ${row.type || 'null'} (${row.entity_type || 'null'}): ${row.count} (обработано: ${row.processed_count})`);
    });
    console.log();

    // 3. Events без entity_type
    console.log('📊 События без entity_type:');
    const noEntityType = await sql`
      SELECT 
        type,
        rentprog_id,
        ext_id,
        payload
      FROM events
      WHERE entity_type IS NULL
      LIMIT 3
    `;
    
    noEntityType.forEach((event, i) => {
      console.log(`\nСобытие ${i + 1}:`);
      console.log(`  Type: ${event.type}`);
      console.log(`  RentProg ID: ${event.rentprog_id}`);
      console.log(`  Ext ID: ${event.ext_id}`);
      console.log(`  Payload keys:`, Object.keys(event.payload || {}).join(', '));
    });
    console.log();

    // 4. Проверим связь с payments
    console.log('📊 Можем ли связать events с payments?');
    const linkableEvents = await sql`
      SELECT 
        COUNT(*) as total_events,
        COUNT(DISTINCT e.rentprog_id) as unique_ids,
        COUNT(*) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM payments p 
            WHERE p.payment_id::text = e.rentprog_id
          )
        ) as found_in_payments
      FROM events e
      WHERE e.entity_type = 'booking'
        OR e.entity_type = 'payment'
        OR e.entity_type = 'car'
    `;
    
    console.log(`  Всего событий: ${linkableEvents[0].total_events}`);
    console.log(`  Уникальных ID: ${linkableEvents[0].unique_ids}`);
    console.log(`  Найдено в payments: ${linkableEvents[0].found_in_payments}`);
    console.log();

    // 5. Примеры событий разных типов
    console.log('📊 Примеры по типам сущностей:');
    const entityTypes = ['booking', 'car', 'client'];
    
    for (const entityType of entityTypes) {
      const [example] = await sql`
        SELECT id, type, rentprog_id, payload
        FROM events
        WHERE entity_type = ${entityType}
        LIMIT 1
      `;
      
      if (example) {
        console.log(`\n${entityType.toUpperCase()}:`);
        console.log(`  Type: ${example.type}`);
        console.log(`  RentProg ID: ${example.rentprog_id}`);
        console.log(`  Payload has:`, Object.keys(example.payload || {}).slice(0, 10).join(', '));
      }
    }
    console.log();

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

main().catch(console.error);

