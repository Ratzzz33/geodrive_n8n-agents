#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres(
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
  { max: 1, ssl: { rejectUnauthorized: false } },
);

try {
  const rows = await sql`
    SELECT id, rentprog_id, branch, number, updated_at
    FROM bookings
    WHERE branch = 'tbilisi' AND number = '4032'
    ORDER BY updated_at DESC
    LIMIT 5;
  `;

  console.log('💾 Текущие записи branch=tbilisi, number=4032:');
  rows.forEach((row) => {
    console.log(row);
  });
} finally {
  await sql.end();
}

