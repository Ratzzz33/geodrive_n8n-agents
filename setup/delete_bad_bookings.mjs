import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

/**
 * Delete bookings without number field
 * 
 * These are corrupted/incomplete records that cannot be used
 */

try {
  console.log('🗑️  Deleting bookings without number...\n');
  
  // Find bookings without number
  const badBookings = await sql`
    SELECT 
      id,
      branch,
      rentprog_id,
      client_name,
      created_at
    FROM bookings
    WHERE number IS NULL
  `;
  
  if (badBookings.length === 0) {
    console.log('✅ No bad bookings found!');
    await sql.end();
    process.exit(0);
  }
  
  console.log(`Found ${badBookings.length} bookings without number:\n`);
  
  badBookings.forEach(b => {
    console.log(`  - ${b.id.substring(0, 8)}... | branch: ${b.branch} | rentprog_id: ${b.rentprog_id} | client: ${b.client_name || 'N/A'}`);
  });
  
  console.log('\nDeleting...\n');
  
  const result = await sql`
    DELETE FROM bookings
    WHERE number IS NULL
    RETURNING id
  `;
  
  console.log(`✅ Deleted ${result.length} bookings`);
  
  // Verify
  const remaining = await sql`
    SELECT COUNT(*) as count
    FROM bookings
    WHERE number IS NULL
  `;
  
  if (remaining[0].count === 0) {
    console.log('✅ Verification: No bookings without number remain');
  } else {
    console.log(`⚠️  Warning: ${remaining[0].count} bookings without number still exist!`);
  }
  
} catch (err) {
  console.error('❌ Error:', err);
  process.exit(1);
} finally {
  await sql.end();
}

