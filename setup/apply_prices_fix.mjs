#!/usr/bin/env node
import postgres from 'postgres';
import fs from 'fs';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function applyFix() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });
  
  try {
    console.log('🛠️  Applying fix for cars_sync_prices_from_data()...\n');
    
    const query = fs.readFileSync('setup/fix_prices_function.sql', 'utf8');
    await sql.unsafe(query);

    console.log('✅ Function updated successfully!');
    console.log('   Now price_values will be stored as JSONB directly.');

  } catch (error) {
    console.error('❌ Error applying fix:', error);
  } finally {
    await sql.end();
  }
}

applyFix();

