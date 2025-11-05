import { Client } from 'pg';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: CONNECTION_STRING, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const totalRes = await client.query('SELECT COUNT(*)::int AS total FROM cars');
    const perBranchRes = await client.query(`
      SELECT b.code as branch, COUNT(c.*)::int AS count
      FROM cars c
      LEFT JOIN branches b ON b.id = c.branch_id
      GROUP BY b.code
      ORDER BY b.code
    `);

    const total = totalRes.rows[0]?.total ?? 0;
    console.log(JSON.stringify({ total, perBranch: perBranchRes.rows }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });


