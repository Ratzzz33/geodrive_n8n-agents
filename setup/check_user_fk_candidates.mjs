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

const uuidRegex = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$';

const candidates = [
  { table: 'clients', column: 'user_id' },
  { table: 'cars', column: 'user_id' },
  { table: 'bookings', column: 'user_id' },
];

const run = async () => {
  console.log('🔍 Проверка колонок *_user_id против таблицы "user"');
  for (const { table, column } of candidates) {
    const query = `
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE "${column}" IS NULL) AS nulls,
        COUNT(*) FILTER (WHERE "${column}" IS NOT NULL) AS filled,
        COUNT(*) FILTER (WHERE "${column}" ~* '${uuidRegex}') AS uuid_like,
        COUNT(*) FILTER (
          WHERE "${column}" ~* '${uuidRegex}'
            AND EXISTS (SELECT 1 FROM "user" u WHERE u.id::text = "${column}")
        ) AS matches
      FROM "${table}";
    `;
    const [row] = await sql.unsafe(query);
    const missing = Number(row.uuid_like) - Number(row.matches);
    console.log(`\n${table}.${column}`);
    console.table({
      total: Number(row.total),
      nulls: Number(row.nulls),
      filled: Number(row.filled),
      uuid_like: Number(row.uuid_like),
      matches: Number(row.matches),
      uuid_without_match: missing,
    });
  }
};

run()
  .catch((err) => {
    console.error('❌ Ошибка проверки user FK:', err);
    process.exitCode = 1;
  })
  .finally(() => sql.end());

