#!/usr/bin/env node
import 'dotenv/config';
import fs from 'fs';
import postgres from 'postgres';

console.error('run_sql_query.mjs starting');

const args = process.argv.slice(2);
let query = '';
if (args[0] === '--file') {
  const filePath = args[1];
  if (!filePath || !fs.existsSync(filePath)) {
    console.error('❌ Укажите существующий файл после --file');
    process.exit(1);
  }
  query = fs.readFileSync(filePath, 'utf8').trim();
  args.splice(0, 2);
} else {
  query = args.join(' ').trim();
}
if (!query && process.env.SQL_QUERY) {
  query = process.env.SQL_QUERY.trim();
}
if (!query) {
  console.error('Usage: node setup/run_sql_query.mjs "<SQL query>"');
  process.exit(1);
}

const fallbackUrl =
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const connectionString =
  (process.env.DATABASE_URL_B64
    ? Buffer.from(process.env.DATABASE_URL_B64, 'base64').toString('utf8')
    : process.env.DATABASE_URL) || fallbackUrl;

const sql = postgres(connectionString, {
  ssl: { rejectUnauthorized: false },
});

const run = async () => {
  console.log(`Running query:\n${query}`);
  const rows = await sql.unsafe(query);
  if (Array.isArray(rows)) {
    for (const row of rows) {
      console.log(JSON.stringify(row));
    }
  } else {
    console.log(JSON.stringify(rows));
  }
};

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => sql.end());

