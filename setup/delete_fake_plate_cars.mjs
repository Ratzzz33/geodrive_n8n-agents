import { Client } from 'pg';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: CONNECTION_STRING, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    // Найдем кандидатов: номера вида AA-123-AA (без пробелов), регистр неважен
    const listRes = await client.query(
      `SELECT id, plate FROM cars WHERE plate IS NOT NULL AND upper(plate) ~ '^[A-Z]{2}-[0-9]{3}-[A-Z]{2}$'`
    );
    const ids = listRes.rows.map(r => r.id);
    console.log(`Found ${ids.length} fake cars by plate pattern (AA-999-AA).`);
    if (ids.length === 0) {
      console.log('Nothing to delete.');
      return;
    }

    // Порядок: external_refs -> bookings (на всякий случай) -> cars
    await client.query('BEGIN');
    try {
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
      const params = ids;

      const delRefs = await client.query(
        `DELETE FROM external_refs WHERE entity_type = 'car' AND entity_id IN (${placeholders}) RETURNING id`,
        params
      );
      const delBookings = await client.query(
        `DELETE FROM bookings WHERE car_id IN (${placeholders}) RETURNING id`,
        params
      );
      const delCars = await client.query(
        `DELETE FROM cars WHERE id IN (${placeholders}) RETURNING id`,
        params
      );

      await client.query('COMMIT');
      console.log(`Deleted: cars=${delCars.rowCount}, external_refs=${delRefs.rowCount}, bookings=${delBookings.rowCount}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } finally {
    await client.end();
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });


