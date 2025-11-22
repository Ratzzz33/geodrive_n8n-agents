import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

/**
 * Add UNIQUE constraint on (branch, number) in bookings table
 * 
 * This constraint is required for UPSERT operations in n8n workflows
 */

try {
  console.log('🔧 Adding UNIQUE constraint to bookings table...\n');
  
  // First, verify no duplicates exist
  const duplicates = await sql`
    SELECT branch, number, COUNT(*) as count
    FROM bookings
    WHERE branch IS NOT NULL AND number IS NOT NULL
    GROUP BY branch, number
    HAVING COUNT(*) > 1
  `;
  
  if (duplicates.length > 0) {
    console.log('❌ ERROR: Duplicates still exist!');
    console.log('Run fix_bookings_duplicates.mjs first to remove duplicates.');
    console.log('\nFound duplicates:');
    console.log(JSON.stringify(duplicates, null, 2));
    process.exit(1);
  }
  
  console.log('✅ No duplicates found');
  
  // Check if constraint already exists
  const existingConstraint = await sql`
    SELECT constraint_name 
    FROM information_schema.table_constraints 
    WHERE table_name = 'bookings' 
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'bookings_branch_number_unique'
  `;
  
  if (existingConstraint.length > 0) {
    console.log('✅ Constraint already exists: bookings_branch_number_unique');
  } else {
    console.log('Creating UNIQUE constraint...');
    
    await sql`
      ALTER TABLE bookings
      ADD CONSTRAINT bookings_branch_number_unique 
      UNIQUE (branch, number)
    `;
    
    console.log('✅ Successfully created constraint: bookings_branch_number_unique');
  }
  
  // Verify constraint was created
  const verification = await sql`
    SELECT 
      conname as constraint_name,
      pg_get_constraintdef(oid) as definition
    FROM pg_constraint 
    WHERE conrelid = 'bookings'::regclass
      AND conname = 'bookings_branch_number_unique'
  `;
  
  if (verification.length > 0) {
    console.log('\n✅ Verification successful:');
    console.log(JSON.stringify(verification[0], null, 2));
    console.log('\n🎯 n8n workflow can now use UPSERT on (branch, number)');
  } else {
    console.log('\n⚠️  Warning: Could not verify constraint');
  }
  
} catch (err) {
  console.error('❌ Error:', err);
  
  if (err.message && err.message.includes('could not create unique index')) {
    console.log('\n💡 Tip: Run fix_bookings_duplicates.mjs to remove duplicates first');
  }
  
  process.exit(1);
} finally {
  await sql.end();
}
