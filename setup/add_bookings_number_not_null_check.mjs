import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

/**
 * Add CHECK constraint to ensure number and branch are NOT NULL
 * 
 * This prevents saving bookings without RentProg identifiers
 */

try {
  console.log('🔧 Adding NOT NULL constraints to bookings table...\n');
  
  // First verify no NULL values exist
  const nullCounts = await sql`
    SELECT 
      COUNT(CASE WHEN number IS NULL THEN 1 END) as null_numbers,
      COUNT(CASE WHEN branch IS NULL THEN 1 END) as null_branches
    FROM bookings
  `;
  
  if (nullCounts[0].null_numbers > 0 || nullCounts[0].null_branches > 0) {
    console.log(`❌ ERROR: Found NULL values!`);
    console.log(`  - NULL numbers: ${nullCounts[0].null_numbers}`);
    console.log(`  - NULL branches: ${nullCounts[0].null_branches}`);
    console.log('\nRun delete_bad_bookings.mjs first to clean up data.');
    process.exit(1);
  }
  
  console.log('✅ No NULL values found');
  console.log('');
  
  // Add NOT NULL constraints
  console.log('Adding NOT NULL constraint on number...');
  await sql`
    ALTER TABLE bookings
    ALTER COLUMN number SET NOT NULL
  `;
  console.log('✅ Done');
  
  console.log('Adding NOT NULL constraint on branch...');
  await sql`
    ALTER TABLE bookings
    ALTER COLUMN branch SET NOT NULL
  `;
  console.log('✅ Done');
  
  // Verify constraints
  console.log('\nVerifying constraints...');
  
  const constraints = await sql`
    SELECT 
      column_name,
      is_nullable
    FROM information_schema.columns
    WHERE table_name = 'bookings'
      AND column_name IN ('number', 'branch')
  `;
  
  console.log('');
  constraints.forEach(c => {
    const status = c.is_nullable === 'NO' ? '✅' : '❌';
    console.log(`  ${status} ${c.column_name}: ${c.is_nullable === 'NO' ? 'NOT NULL' : 'NULLABLE'}`);
  });
  
  console.log('\n✅ Migration successful!');
  console.log('\n🎯 Now bookings cannot be saved without number and branch');
  
} catch (err) {
  console.error('\n❌ Error:', err.message);
  
  if (err.message && err.message.includes('violates not-null constraint')) {
    console.log('\n💡 Tip: Run delete_bad_bookings.mjs first to remove NULL records');
  }
  
  process.exit(1);
} finally {
  await sql.end();
}

