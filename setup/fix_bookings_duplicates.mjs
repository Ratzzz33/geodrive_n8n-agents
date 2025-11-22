import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

/**
 * Fix duplicate bookings in the bookings table
 * 
 * Strategy:
 * 1. For each (branch, number) duplicate group, select ONE record to keep
 * 2. Priority (highest to lowest):
 *    - is_active = true (active bookings are more important)
 *    - state = 'Активная' (active state trumps 'Новая')
 *    - newest created_at (most recent data)
 *    - smallest UUID (deterministic tiebreaker)
 * 3. Delete all other records in the group
 */

try {
  console.log('🔧 Fixing duplicate bookings...\n');
  
  // Find all duplicate groups
  const duplicateGroups = await sql`
    SELECT branch, number
    FROM bookings
    WHERE branch IS NOT NULL AND number IS NOT NULL
    GROUP BY branch, number
    HAVING COUNT(*) > 1
  `;
  
  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicates found!');
    await sql.end();
    process.exit(0);
  }
  
  console.log(`Found ${duplicateGroups.length} duplicate groups\n`);
  
  let totalDeleted = 0;
  
  for (const group of duplicateGroups) {
    const { branch, number } = group;
    
    // Get all records in this duplicate group
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
    
    console.log(`📋 ${branch}-${number}:`);
    console.log(`  ✅ KEEP: ${keepRecord.id.substring(0, 8)}... (active: ${keepRecord.is_active}, state: ${keepRecord.state}, created: ${keepRecord.created_at})`);
    
    for (const rec of deleteRecords) {
      console.log(`  ❌ DELETE: ${rec.id.substring(0, 8)}... (active: ${rec.is_active}, state: ${rec.state}, created: ${rec.created_at})`);
      
      await sql`
        DELETE FROM bookings
        WHERE id = ${rec.id}
      `;
      
      totalDeleted++;
    }
    
    console.log('');
  }
  
  console.log(`\n✅ Successfully deleted ${totalDeleted} duplicate records!`);
  
  // Verify no duplicates remain
  const remainingDuplicates = await sql`
    SELECT branch, number, COUNT(*) as count
    FROM bookings
    WHERE branch IS NOT NULL AND number IS NOT NULL
    GROUP BY branch, number
    HAVING COUNT(*) > 1
  `;
  
  if (remainingDuplicates.length === 0) {
    console.log('✅ Verified: No duplicates remain');
    console.log('\n🎯 Ready to create UNIQUE constraint on (branch, number)');
  } else {
    console.log('⚠️  Warning: Some duplicates still remain:');
    console.log(JSON.stringify(remainingDuplicates, null, 2));
  }
  
} catch (err) {
  console.error('❌ Error:', err);
  process.exit(1);
} finally {
  await sql.end();
}

