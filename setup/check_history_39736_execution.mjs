#!/usr/bin/env node
/**
 * Проверка записи о машине 39736 из execution 27196
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkHistory() {
  console.log('🔍 Проверка записи о машине 39736 из execution 27196...\n');
  
  // Ищем запись в history
  const historyRecord = await sql`
    SELECT 
      id,
      branch,
      operation_type,
      description,
      entity_type,
      entity_id,
      user_name,
      created_at,
      matched,
      processed
    FROM history
    WHERE 
      description LIKE '%39736%'
      AND description LIKE '%company_id с 11163 на 9247%'
      AND created_at >= '2025-11-21 11:14:00'::timestamptz
      AND created_at <= '2025-11-21 11:15:00'::timestamptz
    ORDER BY created_at DESC
    LIMIT 5
  `;
  
  console.log(`📊 Найдено записей в history: ${historyRecord.length}\n`);
  
  for (const record of historyRecord) {
    console.log(`ID: ${record.id}`);
    console.log(`Branch: ${record.branch}`);
    console.log(`Description: ${record.description}`);
    console.log(`Entity Type: ${record.entity_type}`);
    console.log(`Entity ID: ${record.entity_id}`);
    console.log(`User: ${record.user_name}`);
    console.log(`Created At: ${record.created_at}`);
    console.log(`Matched: ${record.matched}`);
    console.log(`Processed: ${record.processed}`);
    console.log('---\n');
  }
  
  // Ищем соответствующее событие в events
  if (historyRecord.length > 0) {
    const record = historyRecord[0];
    const companyId = record.branch === 'tbilisi' ? 9247 : null;
    
    if (companyId) {
      const events = await sql`
        SELECT 
          id,
          type,
          company_id,
          rentprog_id,
          ext_id,
          ts,
          processed
        FROM events
        WHERE 
          company_id = ${companyId}
          AND type = 'car_update'
          AND (rentprog_id = '39736' OR ext_id = '39736')
          AND ts >= '2025-11-21 11:14:00'::timestamptz
          AND ts <= '2025-11-21 11:16:00'::timestamptz
        ORDER BY ts DESC
        LIMIT 5
      `;
      
      console.log(`📊 Найдено событий в events: ${events.length}\n`);
      
      for (const event of events) {
        console.log(`Event ID: ${event.id}`);
        console.log(`Type: ${event.type}`);
        console.log(`Company ID: ${event.company_id}`);
        console.log(`RentProg ID: ${event.rentprog_id}`);
        console.log(`Ext ID: ${event.ext_id}`);
        console.log(`TS: ${event.ts}`);
        console.log(`Processed: ${event.processed}`);
        console.log('---\n');
      }
      
      // Проверяем связь в event_links
      if (events.length > 0 && historyRecord.length > 0) {
        const links = await sql`
          SELECT 
            id,
            entity_type,
            rp_entity_id,
            event_id,
            history_id,
            link_type,
            confidence,
            matched_at
          FROM event_links
          WHERE 
            (event_id = ${events[0].id} AND history_id = ${historyRecord[0].id})
            OR (rp_entity_id = '39736' AND entity_type = 'car')
          ORDER BY matched_at DESC
          LIMIT 5
        `;
        
        console.log(`📊 Найдено связей в event_links: ${links.length}\n`);
        
        for (const link of links) {
          console.log(`Link ID: ${link.id}`);
          console.log(`Entity Type: ${link.entity_type}`);
          console.log(`RP Entity ID: ${link.rp_entity_id}`);
          console.log(`Event ID: ${link.event_id}`);
          console.log(`History ID: ${link.history_id}`);
          console.log(`Link Type: ${link.link_type}`);
          console.log(`Confidence: ${link.confidence}`);
          console.log(`Matched At: ${link.matched_at}`);
          console.log('---\n');
        }
      }
    }
  }
}

checkHistory()
  .then(() => {
    console.log('✅ Проверка завершена');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  })
  .finally(() => {
    sql.end();
  });



