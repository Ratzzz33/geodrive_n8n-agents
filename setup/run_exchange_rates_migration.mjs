#!/usr/bin/env node
import postgres from 'postgres';
import { readFileSync } from 'fs';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('📊 Creating exchange_rates table...\n');
  
  const migration = readFileSync('setup/create_exchange_rates_table.sql', 'utf8');
  
  await sql.unsafe(migration);
  
  console.log('✅ Table created successfully!');
  console.log('\nTable structure:');
  console.log('- id (bigserial)');
  console.log('- created_at (timestamptz)');
  console.log('- branch (text)');
  console.log('- gel_to_rub, gel_to_usd, gel_to_eur (numeric)');
  console.log('- rub_to_gel, usd_to_gel, eur_to_gel (numeric)');
  console.log('- raw_data (jsonb)');
  
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  await sql.end();
}
