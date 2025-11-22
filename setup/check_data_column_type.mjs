#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  const result = await sql`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'bookings' 
    AND column_name IN ('data', 'payload_json')
    ORDER BY column_name
  `;
  
  console.log('Типы колонок в таблице bookings:');
  result.forEach(r => {
    console.log(`  ${r.column_name}: ${r.data_type} (${r.udt_name})`);
  });
  
  // Проверяем как payload_json преобразуется в data
  const test = await sql`
    SELECT 
      rentprog_id,
      payload_json::text as payload_text,
      payload_json::jsonb as payload_as_jsonb,
      data
    FROM bookings
    WHERE payload_json IS NOT NULL
    LIMIT 1
  `;
  
  if (test.length > 0) {
    console.log(`\nПример (бронь ${test[0].rentprog_id}):`);
    console.log(`  payload_json (text): ${test[0].payload_text ? test[0].payload_text.slice(0, 100) + '...' : 'NULL'}`);
    console.log(`  payload_json::jsonb: ${test[0].payload_as_jsonb ? JSON.stringify(test[0].payload_as_jsonb).slice(0, 100) + '...' : 'NULL'}`);
    console.log(`  data: ${test[0].data ? JSON.stringify(test[0].data).slice(0, 100) + '...' : 'EMPTY {}'}`);
  }
  
} catch (error) {
  console.error('Ошибка:', error.message);
} finally {
  await sql.end();
}

