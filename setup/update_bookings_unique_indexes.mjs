#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING =
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log('🚧 Updating bookings unique indexes...');
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe('DROP INDEX IF EXISTS bookings_rentprog_id_idx;');
      await tx.unsafe(
        'CREATE UNIQUE INDEX IF NOT EXISTS bookings_rentprog_id_unique ON bookings (rentprog_id) WHERE rentprog_id IS NOT NULL;',
      );

      await tx.unsafe('ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_branch_number_unique;');
      await tx.unsafe('ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_branch_number_id_unique;');
      await tx.unsafe('DROP INDEX IF EXISTS bookings_branch_number_unique;');
      await tx.unsafe('DROP INDEX IF EXISTS bookings_branch_number_id_unique;');
      await tx.unsafe(
        'CREATE UNIQUE INDEX IF NOT EXISTS bookings_branch_number_manual_unique ON bookings (branch, number) WHERE rentprog_id IS NULL;',
      );
    });
    console.log('✅ Indexes updated successfully');
  } finally {
    await sql.end();
  }
}

run().catch((error) => {
  console.error('❌ Failed to update indexes:', error);
  process.exitCode = 1;
});

