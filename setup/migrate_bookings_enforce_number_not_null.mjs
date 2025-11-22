#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

/**
 * Complete migration to enforce NOT NULL on bookings(number, branch)
 * 
 * Steps:
 * 1. Delete bookings without number or branch (corrupted records)
 * 2. Add NOT NULL constraints to prevent future issues
 */

async function deleteBadBookings() {
  console.log('📋 Step 1: Deleting bookings without number/branch...\n');
  
  const badBookings = await sql`
    SELECT 
      id,
      branch,
      number,
      rentprog_id,
      client_name
    FROM bookings
    WHERE number IS NULL OR branch IS NULL
  `;
  
  if (badBookings.length === 0) {
    console.log('  ✅ No bad bookings found!\n');
    return 0;
  }
  
  console.log(`  Found ${badBookings.length} bad bookings:\n`);
  
  badBookings.forEach(b => {
    console.log(`    - ${b.id.substring(0, 8)}... | branch: ${b.branch || 'NULL'} | number: ${b.number || 'NULL'} | rentprog_id: ${b.rentprog_id}`);
  });
  
  console.log('\n  Deleting...\n');
  
  const result = await sql`
    DELETE FROM bookings
    WHERE number IS NULL OR branch IS NULL
    RETURNING id
  `;
  
  console.log(`  ✅ Deleted ${result.length} bookings\n`);
  
  return result.length;
}

async function addNotNullConstraints() {
  console.log('📋 Step 2: Adding NOT NULL constraints...\n');
  
  // Check current state
  const columns = await sql`
    SELECT 
      column_name,
      is_nullable
    FROM information_schema.columns
    WHERE table_name = 'bookings'
      AND column_name IN ('number', 'branch')
  `;
  
  let changedCount = 0;
  
  for (const col of columns) {
    if (col.is_nullable === 'YES') {
      console.log(`  Adding NOT NULL to ${col.column_name}...`);
      await sql.unsafe(`
        ALTER TABLE bookings
        ALTER COLUMN ${col.column_name} SET NOT NULL
      `);
      console.log(`  ✅ Done`);
      changedCount++;
    } else {
      console.log(`  ℹ️  ${col.column_name} already NOT NULL`);
    }
  }
  
  console.log('');
  return changedCount;
}

async function verifyMigration() {
  console.log('📋 Step 3: Verification...\n');
  
  // Check no NULL values
  const nullCounts = await sql`
    SELECT 
      COUNT(CASE WHEN number IS NULL THEN 1 END) as null_numbers,
      COUNT(CASE WHEN branch IS NULL THEN 1 END) as null_branches
    FROM bookings
  `;
  
  if (nullCounts[0].null_numbers > 0 || nullCounts[0].null_branches > 0) {
    console.log('  ❌ ERROR: NULL values still exist!');
    return false;
  }
  
  console.log('  ✅ No NULL values');
  
  // Check constraints
  const constraints = await sql`
    SELECT 
      column_name,
      is_nullable
    FROM information_schema.columns
    WHERE table_name = 'bookings'
      AND column_name IN ('number', 'branch')
  `;
  
  let allNotNull = true;
  constraints.forEach(c => {
    const isNotNull = c.is_nullable === 'NO';
    const status = isNotNull ? '✅' : '❌';
    console.log(`  ${status} ${c.column_name}: ${isNotNull ? 'NOT NULL' : 'NULLABLE'}`);
    if (!isNotNull) allNotNull = false;
  });
  
  console.log('');
  return allNotNull;
}

// Main execution
try {
  console.log('🚀 Starting migration: Enforce NOT NULL on bookings(number, branch)\n');
  console.log('=' .repeat(60));
  console.log('');
  
  const deletedCount = await deleteBadBookings();
  const changedCount = await addNotNullConstraints();
  const verified = await verifyMigration();
  
  console.log('=' .repeat(60));
  console.log('');
  
  if (verified) {
    console.log('✅ MIGRATION SUCCESSFUL!\n');
    console.log('Summary:');
    console.log(`  - Bad bookings deleted: ${deletedCount}`);
    console.log(`  - Constraints added: ${changedCount}`);
    console.log('');
    console.log('🎯 Benefits:');
    console.log('  ✅ Cannot save bookings without number');
    console.log('  ✅ Cannot save bookings without branch');
    console.log('  ✅ UNIQUE(branch, number) constraint will always work');
    console.log('');
    console.log('⚠️  NEXT STEP: Update workflow validation');
    console.log('   All workflows must validate attrs.number before saving!');
    console.log('');
  } else {
    console.log('❌ MIGRATION FAILED!');
    console.log('');
    process.exit(1);
  }
  
} catch (err) {
  console.error('\n❌ Migration error:', err.message);
  console.error(err);
  process.exit(1);
} finally {
  await sql.end();
}

