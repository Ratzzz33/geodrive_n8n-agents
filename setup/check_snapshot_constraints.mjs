#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkConstraints() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });
  try {
    console.log('🔍 Checking constraints on rentprog_car_states_snapshot...\n');
    
    const constraints = await sql`
      SELECT conname, contype, pg_get_constraintdef(oid)
      FROM pg_constraint
      WHERE conrelid = 'rentprog_car_states_snapshot'::regclass;
    `;

    if (constraints.length === 0) {
      console.log('⚠️ No constraints found.');
    } else {
      console.log('📋 Constraints:');
      constraints.forEach(con => {
        console.log(`  - ${con.conname} (${con.contype}): ${con.pg_get_constraintdef}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

checkConstraints();
