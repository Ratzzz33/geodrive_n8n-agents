#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkTableStructure() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });
  try {
    console.log('🔍 Checking table structure for rentprog_car_states_snapshot...\n');
    
    const columns = await sql`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'rentprog_car_states_snapshot'
      ORDER BY ordinal_position;
    `;

    console.log('📋 Columns:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.udt_name})`);
    });

    console.log('\n🔍 Checking triggers on rentprog_car_states_snapshot...\n');
    const triggers = await sql`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'rentprog_car_states_snapshot';
    `;

    if (triggers.length === 0) {
      console.log('✅ No triggers found.');
    } else {
      console.log('⚠️ Triggers found:');
      triggers.forEach(trig => {
        console.log(`  - ${trig.trigger_name}: ${trig.event_manipulation}`);
        console.log(`    Action: ${trig.action_statement}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

checkTableStructure();

