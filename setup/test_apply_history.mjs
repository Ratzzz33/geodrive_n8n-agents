#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

const id = process.argv[2];
if (!id) {
  console.log('Usage: node setup/test_apply_history.mjs <history_id>');
  process.exit(1);
}

const rows = await sql`
  SELECT apply_history_changes(
    h.id,
    parsed.entity_type,
    parsed.entity_id,
    parsed.operation,
    h.branch,
    h.raw_data,
    h.description,
    parsed.amount,
    parsed.currency,
    parsed.extra
  ) AS applied
  FROM history h
  CROSS JOIN LATERAL parse_history_description(h.description) parsed
  WHERE h.id = ${id}::bigint
`;

console.log(rows);
await sql.end();

