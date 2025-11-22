#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres(
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
  { max: 1, ssl: { rejectUnauthorized: false } },
);

try {
  const rows = await sql`
    SELECT id, rentprog_id, branch, number, created_at, updated_at
    FROM bookings
    WHERE branch = 'tbilisi' AND number = '3976'
    ORDER BY updated_at DESC
    LIMIT 10;
  `;
  console.log(rows);
} finally {
  await sql.end();
}

