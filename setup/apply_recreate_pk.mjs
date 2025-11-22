#!/usr/bin/env node
import postgres from 'postgres';
import fs from 'fs';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function applyRecreatePK() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });
  
  try {
    console.log('🛠️  Recreating Primary Key on rentprog_car_states_snapshot...\n');
    
    const query = fs.readFileSync('setup/recreate_pk.sql', 'utf8');
    await sql.unsafe(query);

    console.log('✅ Primary Key recreated successfully!');

  } catch (error) {
    console.error('❌ Error applying fix:', error);
  } finally {
    await sql.end();
  }
}

applyRecreatePK();

