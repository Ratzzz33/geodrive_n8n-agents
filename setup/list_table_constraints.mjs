#!/usr/bin/env node
import 'dotenv/config';
import postgres from 'postgres';

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
  const tables = process.argv.slice(2);
  if (tables.length === 0) {
    console.error('Usage: node setup/list_table_constraints.mjs <table_name> [table_name...]');
    process.exit(1);
  }

  const rows = await sql`
    SELECT table_name, constraint_name, constraint_type
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = ANY(${tables})
      AND constraint_type = 'FOREIGN KEY'
  `;
  console.table(rows);
};

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => sql.end());

