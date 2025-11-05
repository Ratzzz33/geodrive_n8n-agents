import { Client } from 'pg';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: CONNECTION_STRING, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const res = await client.query(
      `SELECT id, model, year, vin, engine_power
       FROM cars
       WHERE year = 2022 AND model ILIKE '%Sportage%'
       ORDER BY updated_at DESC`
    );
    console.log(JSON.stringify(res.rows, null, 2));
  } finally {
    await client.end();
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });


