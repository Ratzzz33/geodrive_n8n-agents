#!/usr/bin/env node
/**
 * Проверка наличия платежей в таблице payments по списку RentProg ID
 */

import postgres from 'postgres';

const CONNECTION =
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION, {
  max: 1,
  ssl: { rejectUnauthorized: false },
});

async function check(ids) {
  const paymentsRows = await sql`
    SELECT rp_payment_id, branch, amount, payment_date, description
    FROM payments
    WHERE rp_payment_id = ANY(${ids})
    ORDER BY rp_payment_id
  `;

  const refsRows = await sql`
    SELECT external_id, entity_id
    FROM external_refs
    WHERE entity_type = 'payment'
      AND system = 'rentprog'
      AND external_id = ANY(${ids.map(String)})
    ORDER BY external_id::int
  `;

  const historyRows = await sql`
    SELECT id, branch, description, notes
    FROM history
    WHERE description LIKE ANY(${ids.map((id) => `%${id}%`)})
      AND processed IS NOT TRUE
    ORDER BY created_at ASC
  `;

  console.log('Payments table:');
  console.table(paymentsRows);
  console.log('\nExternal refs:');
  console.table(refsRows);
  console.log('\nPending history entries (first 5):');
  console.table(historyRows.slice(0, 5));
}

async function main() {
  const ids = process.argv.slice(2).map(Number).filter(Boolean);
  if (ids.length === 0) {
    console.log('Usage: node setup/check_payments_for_history.mjs <id1> <id2> ...');
    process.exit(1);
  }
  await check(ids);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });

