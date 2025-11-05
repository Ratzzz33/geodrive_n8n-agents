import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkTriggerStatus() {
  console.log('🔍 Checking trigger status\n');
  
  // Проверить наличие триггера
  const trigger = await sql`
    SELECT 
      tgname as trigger_name,
      tgenabled as enabled,
      tgtype as trigger_type,
      pg_get_triggerdef(oid) as definition
    FROM pg_trigger
    WHERE tgname = 'process_booking_nested_entities_trigger'
  `.then(rows => rows[0]);
  
  if (!trigger) {
    console.log('❌ Trigger NOT FOUND!');
    return;
  }
  
  console.log(`Trigger: ${trigger.trigger_name}`);
  console.log(`Enabled: ${trigger.enabled === 'O' ? 'YES' : 'NO'}`);
  console.log(`Type: ${trigger.trigger_type}`);
  console.log(`\nDefinition:\n${trigger.definition}`);
  
  // Проверить наличие функции
  console.log('\n\nChecking function...');
  const func = await sql`
    SELECT 
      proname as function_name,
      pg_get_functiondef(oid) as definition
    FROM pg_proc
    WHERE proname = 'process_booking_nested_entities'
  `.then(rows => rows[0]);
  
  if (!func) {
    console.log('❌ Function NOT FOUND!');
  } else {
    console.log(`✅ Function exists: ${func.function_name}`);
  }
  
  await sql.end();
}

checkTriggerStatus();

