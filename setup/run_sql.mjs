#!/usr/bin/env node
import postgres from 'postgres';

const query = process.argv.slice(2).join(' ');
if (!query) {
  console.error('Usage: node setup/run_sql.mjs <SQL>');
  process.exit(1);
}

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

const result = await sql.unsafe(query);
console.log(result);
await sql.end();

