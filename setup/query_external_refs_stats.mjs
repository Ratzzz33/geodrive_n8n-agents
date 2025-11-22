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
  const rows = await sql`
    SELECT entity_type, system, COUNT(*)::bigint AS count
    FROM external_refs
    GROUP BY entity_type, system
    ORDER BY count DESC
  `;
  console.table(rows.map((row) => ({
    entity_type: row.entity_type,
    system: row.system,
    count: Number(row.count),
  })));
};

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => sql.end());

