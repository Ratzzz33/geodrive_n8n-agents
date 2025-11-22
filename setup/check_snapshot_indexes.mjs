#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkIndexes() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });
  try {
    console.log('🔍 Checking indexes on rentprog_car_states_snapshot...\n');
    
    const indexes = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'rentprog_car_states_snapshot';
    `;

    if (indexes.length === 0) {
      console.log('⚠️ No indexes found.');
    } else {
      console.log('📋 Indexes:');
      indexes.forEach(idx => {
        console.log(`  - ${idx.indexname}: ${idx.indexdef}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

checkIndexes();

