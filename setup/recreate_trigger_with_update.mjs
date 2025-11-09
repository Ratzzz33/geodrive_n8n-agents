#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function recreateTrigger() {
  const sql = postgres(CONNECTION_STRING, {max: 1, ssl: {rejectUnauthorized: false}});
  
  console.log('\n🔧 Пересоздание триггера с INSERT OR UPDATE...\n');
  
  await sql`DROP TRIGGER IF EXISTS process_booking_nested_entities_trigger ON bookings`;
  console.log('✅ Старый триггер удален');
  
  await sql`
    CREATE TRIGGER process_booking_nested_entities_trigger
    BEFORE INSERT OR UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION process_booking_nested_entities()
  `;
  console.log('✅ Триггер создан с INSERT OR UPDATE');
  
  // Проверка
  const check = await sql`
    SELECT 
      tgname,
      CASE WHEN tgtype & 2 = 2 THEN 'BEFORE' ELSE 'AFTER' END as timing,
      CASE 
        WHEN (tgtype & 4) != 0 AND (tgtype & 16) != 0 THEN 'INSERT, UPDATE'
        WHEN (tgtype & 4) != 0 THEN 'INSERT'
        WHEN (tgtype & 16) != 0 THEN 'UPDATE'
        ELSE 'OTHER'
      END as events
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'bookings'
      AND tgname = 'process_booking_nested_entities_trigger'
  `.then(rows => rows[0]);
  
  console.log('\n📋 Проверка:');
  console.log(`   Timing: ${check.timing}`);
  console.log(`   Events: ${check.events}`);
  
  await sql.end();
}

recreateTrigger();

