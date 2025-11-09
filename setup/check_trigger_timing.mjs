#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkTriggerTiming() {
  const sql = postgres(CONNECTION_STRING, {max: 1, ssl: {rejectUnauthorized: false}});
  
  const result = await sql`
    SELECT 
      tgname,
      CASE 
        WHEN tgtype & 2 = 2 THEN 'BEFORE'
        WHEN tgtype & 64 = 64 THEN 'INSTEAD OF'
        ELSE 'AFTER'
      END as timing,
      CASE
        WHEN tgtype & 4 = 4 THEN 'INSERT'
        WHEN tgtype & 8 = 8 THEN 'DELETE'
        WHEN tgtype & 16 = 16 THEN 'UPDATE'
        ELSE 'UNKNOWN'
      END as event
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'bookings'
      AND tgname = 'process_booking_nested_entities_trigger'
  `.then(rows => rows[0]);
  
  console.log('Триггер:', result.tgname);
  console.log('Timing:', result.timing);
  console.log('Event:', result.event);
  
  await sql.end();
}

checkTriggerTiming();

