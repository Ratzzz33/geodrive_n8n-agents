#!/usr/bin/env node
import fs from 'fs';
import postgres from 'postgres';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node setup/run_migration_file.mjs <path-to-sql>');
  process.exit(1);
}

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  const query = fs.readFileSync(filePath, 'utf8');
  await sql.unsafe(query);
  console.log(`✅ Migration applied: ${filePath}`);
} catch (error) {
  console.error(`❌ Migration failed for ${filePath}:`, error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}

