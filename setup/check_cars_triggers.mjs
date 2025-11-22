#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkCarsTriggers() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });
  try {
    console.log('🔍 Checking triggers on cars table...\n');
    
    const triggers = await sql`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'cars';
    `;

    if (triggers.length === 0) {
      console.log('✅ No triggers found on cars table.');
    } else {
      console.log('⚠️ Triggers found on cars table:');
      triggers.forEach(trig => {
        console.log(`  - ${trig.trigger_name}: ${trig.event_manipulation}`);
        console.log(`    Action: ${trig.action_statement}`);
      });
    }

    // Also checking if cars table has price_values column
    const columns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'cars' AND column_name = 'price_values';
    `;
    
    if (columns.length > 0) {
      console.log(`\n⚠️ Found column 'price_values' in cars table: ${columns[0].data_type}`);
    } else {
      console.log(`\n✅ No 'price_values' column in cars table.`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

checkCarsTriggers();

