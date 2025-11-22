#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false },
  connect_timeout: 10
});

try {
  console.log('🔍 Список triggers на таблице bookings:\n');
  
  const triggers = await sql`
    SELECT
      tgname AS trigger_name,
      pg_get_triggerdef(oid) AS definition,
      tgenabled AS enabled
    FROM pg_trigger
    WHERE tgrelid = 'bookings'::regclass
      AND tgisinternal = false
    ORDER BY tgname;
  `;
  
  if (triggers.length === 0) {
    console.log('❌ Нет triggers на таблице bookings');
  } else {
    triggers.forEach((t, i) => {
      console.log(`${i + 1}. ${t.trigger_name}`);
      console.log(`   Enabled: ${t.enabled === 'O' ? '✅ YES' : '❌ NO'}`);
      console.log(`   Definition: ${t.definition}`);
      console.log('');
    });
  }
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

