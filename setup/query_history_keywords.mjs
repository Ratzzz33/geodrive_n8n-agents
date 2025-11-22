#!/usr/bin/env node
/**
 * Статистика по history по ключевым словам в description
 */

import postgres from 'postgres';

const CONNECTION =
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION, {
  max: 1,
  ssl: { rejectUnauthorized: false },
});

const KEYWORDS = [
  { label: 'Parser%', pattern: "description ILIKE 'Parser%'" },
  { label: 'StarMech', pattern: "description ILIKE 'StarMech%'" },
  { label: 'Виноградский', pattern: "description ILIKE 'Виноградский%'" },
];

async function main() {
  const rows = await Promise.all(
    KEYWORDS.map(async ({ label, pattern }) => {
      const [{ total, pending }] = await sql.unsafe(
        `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE processed IS NOT TRUE) AS pending FROM history WHERE ${pattern}`
      );
      return { label, total, pending };
    })
  );

  console.table(rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
