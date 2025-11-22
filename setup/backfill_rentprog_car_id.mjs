#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  const result = await sql.unsafe(`
    WITH mapped AS (
      SELECT b.id AS booking_id, er.external_id AS rentprog_car_id
      FROM bookings b
      JOIN external_refs er
        ON er.entity_id = b.car_id
       AND er.entity_type = 'car'
       AND er.system = 'rentprog'
      WHERE b.rentprog_car_id IS NULL
        AND er.external_id IS NOT NULL
    )
    UPDATE bookings b
    SET rentprog_car_id = m.rentprog_car_id
    FROM mapped m
    WHERE b.id = m.booking_id
    RETURNING b.id, m.rentprog_car_id
  `);

  console.log(`✅ Updated ${result.length} bookings with rentprog_car_id`);
} catch (error) {
  console.error('❌ Backfill failed:', error);
  process.exitCode = 1;
} finally {
  await sql.end();
}

