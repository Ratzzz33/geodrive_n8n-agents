#!/usr/bin/env node

/**
 * Check specific history record 624721
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkRecord() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 Checking history record 624721...\n');

    const record = await sql`
      SELECT *
      FROM history
      WHERE id = 624721
    `;

    if (record.length === 0) {
      console.log('❌ Record not found');
      return;
    }

    const r = record[0];
    console.log('Record details:');
    console.log(`  ID: ${r.id}`);
    console.log(`  Timestamp: ${r.ts}`);
    console.log(`  Branch: ${r.branch}`);
    console.log(`  Operation Type: ${r.operation_type}`);
    console.log(`  Operation ID: ${r.operation_id}`);
    console.log(`  Entity Type: ${r.entity_type}`);
    console.log(`  Entity ID: ${r.entity_id}`);
    console.log(`  User Name: ${r.user_name}`);
    console.log(`  Processed: ${r.processed}`);
    console.log(`  Matched: ${r.matched}`);
    console.log(`  Notes: ${r.notes || 'NULL'}`);
    console.log(`\n  Description:`);
    console.log(`    ${r.description}`);
    
    console.log(`\n  Raw Data:`);
    if (r.raw_data && typeof r.raw_data === 'object') {
      console.log(JSON.stringify(r.raw_data, null, 2));
    } else {
      console.log(`    ${r.raw_data || 'NULL'}`);
    }

    console.log(`\n  Created At: ${r.created_at}`);

    // Check if raw_data has car_class
    if (r.raw_data && typeof r.raw_data === 'object') {
      if (r.raw_data.car_class) {
        console.log(`\n✅ raw_data contains car_class: ${r.raw_data.car_class}`);
      } else {
        console.log(`\n❌ raw_data does NOT contain car_class field!`);
        console.log(`   This is why the update didn't happen.`);
      }
    } else {
      console.log(`\n❌ raw_data is empty or invalid!`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

checkRecord().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

