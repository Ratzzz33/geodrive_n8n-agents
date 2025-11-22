#!/usr/bin/env node
import 'dotenv/config';
import postgres from 'postgres';

console.error('describe_tables.mjs starting');

const tables = process.argv.slice(2);
if (tables.length === 0) {
  console.error('Usage: node setup/describe_tables.mjs table1 table2 ...');
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
  for (const table of tables) {
    const rows = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${table}
      ORDER BY ordinal_position
    `;
    console.log(`\nTable: ${table}`);
    for (const row of rows) {
      console.log(JSON.stringify(row));
    }
  }
};

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => sql.end());

