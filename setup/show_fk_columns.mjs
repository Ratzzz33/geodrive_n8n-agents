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
    SELECT tc.table_name, kcu.column_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name IN ('battery_voltage_history', 'battery_voltage_alerts', 'speed_history', 'speed_violations', 'gps_tracking')
  `;
  console.table(rows);
};

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => sql.end());

