#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

/**
 * Complete migration to add UNIQUE constraint on bookings(branch, number)
 * 
 * Steps:
 * 1. Remove duplicate records (keeping the most relevant one)
 * 2. Add UNIQUE constraint
 */

async function removeDuplicates() {
  console.log('📋 Step 1: Removing duplicate bookings...\n');
  
  const duplicateGroups = await sql`
    SELECT branch, number
    FROM bookings
    WHERE branch IS NOT NULL AND number IS NOT NULL
    GROUP BY branch, number
    HAVING COUNT(*) > 1
  `;
  
  if (duplicateGroups.length === 0) {
    console.log('  ✅ No duplicates found!\n');
    return 0;
  }
  
  console.log(`  Found ${duplicateGroups.length} duplicate groups\n`);
  
  let totalDeleted = 0;
  
  for (const group of duplicateGroups) {
    const { branch, number } = group;
    
    // Get all records, ordered by priority
    const records = await sql`
      SELECT 
        id,
        branch,
        number,
        created_at,
        is_active,
        state,
        start_at
      FROM bookings
      WHERE branch = ${branch} AND number = ${number}
      ORDER BY 
        CASE WHEN is_active THEN 1 ELSE 0 END DESC,
        CASE 
          WHEN state = 'Активная' THEN 1 
          WHEN state = 'Новая' THEN 2
          ELSE 3
        END ASC,
        created_at DESC,
        id ASC
    `;
    
    const keepRecord = records[0];
    const deleteRecords = records.slice(1);
    
    console.log(`  📋 ${branch}-${number}:`);
    console.log(`     ✅ KEEP: ${keepRecord.id.substring(0, 8)}... (active: ${keepRecord.is_active}, state: ${keepRecord.state})`);
    
    for (const rec of deleteRecords) {
      console.log(`     ❌ DELETE: ${rec.id.substring(0, 8)}... (active: ${rec.is_active}, state: ${rec.state})`);
      
      await sql`
        DELETE FROM bookings
        WHERE id = ${rec.id}
      `;
      
      totalDeleted++;
    }
    
    console.log('');
  }
  
  console.log(`  ✅ Deleted ${totalDeleted} duplicate records\n`);
  return totalDeleted;
}

async function addUniqueConstraint() {
  console.log('📋 Step 2: Adding UNIQUE constraint...\n');
  
  // Check if constraint already exists
  const existingConstraint = await sql`
    SELECT constraint_name 
    FROM information_schema.table_constraints 
    WHERE table_name = 'bookings' 
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'bookings_branch_number_unique'
  `;
  
  if (existingConstraint.length > 0) {
    console.log('  ℹ️  Constraint already exists: bookings_branch_number_unique\n');
    return false;
  }
  
  console.log('  Creating constraint...');
  
  await sql`
    ALTER TABLE bookings
    ADD CONSTRAINT bookings_branch_number_unique 
    UNIQUE (branch, number)
  `;
  
  console.log('  ✅ Successfully created constraint: bookings_branch_number_unique\n');
  return true;
}

async function verifyMigration() {
  console.log('📋 Step 3: Verification...\n');
  
  // Check no duplicates remain
  const remainingDuplicates = await sql`
    SELECT branch, number, COUNT(*) as count
    FROM bookings
    WHERE branch IS NOT NULL AND number IS NOT NULL
    GROUP BY branch, number
    HAVING COUNT(*) > 1
  `;
  
  if (remainingDuplicates.length > 0) {
    console.log('  ❌ ERROR: Duplicates still exist!');
    console.log(JSON.stringify(remainingDuplicates, null, 2));
    return false;
  }
  
  console.log('  ✅ No duplicates remain');
  
  // Verify constraint exists
  const constraint = await sql`
    SELECT 
      conname as constraint_name,
      pg_get_constraintdef(oid) as definition
    FROM pg_constraint 
    WHERE conrelid = 'bookings'::regclass
      AND conname = 'bookings_branch_number_unique'
  `;
  
  if (constraint.length === 0) {
    console.log('  ❌ ERROR: Constraint not found!');
    return false;
  }
  
  console.log('  ✅ Constraint verified:');
  console.log(`     ${constraint[0].definition}\n`);
  
  return true;
}

// Main execution
try {
  console.log('🚀 Starting migration: Add UNIQUE constraint on bookings(branch, number)\n');
  console.log('=' .repeat(60));
  console.log('');
  
  const deletedCount = await removeDuplicates();
  const constraintAdded = await addUniqueConstraint();
  const verified = await verifyMigration();
  
  console.log('=' .repeat(60));
  console.log('');
  
  if (verified) {
    console.log('✅ MIGRATION SUCCESSFUL!\n');
    console.log('Summary:');
    console.log(`  - Duplicates removed: ${deletedCount}`);
    console.log(`  - Constraint added: ${constraintAdded ? 'Yes' : 'Already existed'}`);
    console.log('');
    console.log('🎯 n8n workflow "✅Парсинг броней RentProg (неактивные, Батуми)"');
    console.log('   can now successfully save to DB using UPSERT on (branch, number)');
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

