#!/usr/bin/env node
/**
 * Выводит примеры необработанных history записей
 */

import postgres from 'postgres';

const CONNECTION = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const rows = await sql.unsafe(`
    SELECT id, branch, operation_type, description, notes
    FROM history
    WHERE processed IS NOT TRUE
    ORDER BY created_at ASC
    LIMIT 20
  `);
  for (const row of rows) {
    console.log('---');
    console.log(row);
  }
}

main()
  .catch((error) => {
    console.error('query_history_samples failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });

