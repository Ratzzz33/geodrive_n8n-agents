#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkPricesFunction() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });
  try {
    console.log('🔍 Getting definition for cars_sync_prices_from_data()...\n');
    
    const funcDef = await sql`
      SELECT pg_get_functiondef('cars_sync_prices_from_data'::regproc);
    `;

    if (funcDef.length > 0) {
      console.log(funcDef[0].pg_get_functiondef);
    } else {
      console.log('❌ Function not found.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

checkPricesFunction();

