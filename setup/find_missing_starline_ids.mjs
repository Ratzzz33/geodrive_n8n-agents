#!/usr/bin/env node
import 'dotenv/config';
import postgres from 'postgres';

const tables = [
  { table: 'battery_voltage_history', column: 'starline_device_id' },
  { table: 'battery_voltage_alerts', column: 'starline_device_id' },
  { table: 'speed_history', column: 'starline_device_id' },
  { table: 'speed_violations', column: 'starline_device_id' },
  { table: 'gps_tracking', column: 'starline_device_id' },
];

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
  console.log('🔎 Поиск отсутствующих starline_device_id');
  for (const { table, column } of tables) {
    const rows = await sql`
      SELECT ${sql(column)} AS missing_id, COUNT(*)::bigint AS cnt
      FROM ${sql(table)}
      WHERE ${sql(column)} IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM starline_devices sd
          WHERE sd.id = ${sql(column)}
        )
      GROUP BY ${sql(column)}
      ORDER BY cnt DESC
      LIMIT 20
    `;
    console.log(`\n${table}.${column} → ${rows.length} missing values`);
    console.table(rows);
  }
};

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => sql.end());

