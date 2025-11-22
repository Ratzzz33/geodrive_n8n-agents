#!/usr/bin/env node
/**
 * Статистика по history с Parser*
 */

import postgres from 'postgres';

const CONNECTION =
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION, {
  max: 1,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const [{ total_parser, pending_parser }] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE description ILIKE 'Parser%') AS total_parser,
      COUNT(*) FILTER (WHERE processed IS NOT TRUE AND description ILIKE 'Parser%') AS pending_parser
    FROM history
  `;
  console.log({ total_parser, pending_parser });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });

