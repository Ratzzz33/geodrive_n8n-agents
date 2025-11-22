#!/usr/bin/env node
import 'dotenv/config';
import fs from 'fs';
import postgres from 'postgres';

if (process.argv.length < 3) {
  console.error('Usage: node setup/apply_sql_file.mjs path/to/file.sql');
  process.exit(1);
}

const filePath = process.argv[2];
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const sqlText = fs.readFileSync(filePath, 'utf8');
if (!sqlText.trim()) {
  console.error('SQL file is empty');
  process.exit(1);
}

const fallbackUrl =
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const connectionString =
  (process.env.DATABASE_URL_B64
    ? Buffer.from(process.env.DATABASE_URL_B64, 'base64').toString('utf8')
    : process.env.DATABASE_URL) || fallbackUrl;

const sql = postgres(connectionString, {
  max: 1,
  ssl: { rejectUnauthorized: false },
});

const run = async () => {
  console.log(`📄 Executing ${filePath}`);
  await sql.unsafe(sqlText);
  console.log('✅ Done');
};

run()
  .catch((err) => {
    console.error('❌ Error executing SQL:', err);
    process.exitCode = 1;
  })
  .finally(() => sql.end());