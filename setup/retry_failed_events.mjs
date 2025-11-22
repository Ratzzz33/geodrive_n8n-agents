#!/usr/bin/env node
/**
 * Повторная обработка событий с ошибками (events)
 */

import postgres from 'postgres';

const CONNECTION = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  let total = 0;
  for (let i = 0; i < 20; i++) {
    const [{ retried_count, success_count, error_count }] = await sql.unsafe(
      'SELECT * FROM retry_failed_events();'
    );
    console.log(
      `Iteration ${i + 1}: retried=${retried_count} success=${success_count} errors=${error_count}`
    );
    total += retried_count ?? 0;
    if (!retried_count) break;
  }
  console.log(`Total retried: ${total}`);
}

main()
  .catch((error) => {
    console.error('retry_failed_events failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });

