#!/usr/bin/env node

/**
 * Check for unprocessed history records after the fix
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkUnprocessed() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 Checking for unprocessed history records...\n');

    // Total unprocessed
    const unprocessed = await sql`
      SELECT COUNT(*) as count
      FROM history
      WHERE processed = FALSE
    `;
    console.log(`Total unprocessed: ${unprocessed[0].count}`);

    // By entity_type
    const byType = await sql`
      SELECT entity_type, COUNT(*) as count
      FROM history
      WHERE processed = FALSE
      GROUP BY entity_type
      ORDER BY count DESC
    `;
    console.log('\nBy entity_type:');
    byType.forEach(row => {
      console.log(`  ${row.entity_type || 'NULL'}: ${row.count}`);
    });

    // Recent car_class changes for car 39736
    const carChanges = await sql`
      SELECT id, ts, operation_type, description, processed, notes
      FROM history
      WHERE description ILIKE '%39736%'
        AND description ILIKE '%car_class%'
      ORDER BY created_at DESC
      LIMIT 5
    `;
    console.log('\n🚗 Recent car_class changes for car 39736:');
    if (carChanges.length === 0) {
      console.log('  No records found');
    } else {
      carChanges.forEach(row => {
        console.log(`\n  ID: ${row.id}`);
        console.log(`  Time: ${row.ts}`);
        console.log(`  Type: ${row.operation_type}`);
        console.log(`  Processed: ${row.processed}`);
        console.log(`  Description: ${row.description.substring(0, 100)}...`);
        if (row.notes) {
          console.log(`  Notes: ${row.notes}`);
        }
      });
    }

    // Records with errors in notes
    const withErrors = await sql`
      SELECT COUNT(*) as count
      FROM history
      WHERE notes IS NOT NULL
        AND notes ILIKE '%ошибка%'
    `;
    console.log(`\n❌ Records with errors in notes: ${withErrors[0].count}`);

    if (parseInt(withErrors[0].count) > 0) {
      const errorSamples = await sql`
        SELECT id, operation_type, entity_type, notes
        FROM history
        WHERE notes IS NOT NULL
          AND notes ILIKE '%ошибка%'
        ORDER BY created_at DESC
        LIMIT 3
      `;
      console.log('\nSample error records:');
      errorSamples.forEach(row => {
        console.log(`\n  ID: ${row.id} | Type: ${row.entity_type} | Op: ${row.operation_type}`);
        console.log(`  Notes: ${row.notes}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

checkUnprocessed().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

