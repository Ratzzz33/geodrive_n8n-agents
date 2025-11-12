import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('Checking indexes on gps_tracking table...');
  
  const indexes = await sql`
    SELECT 
      indexname, 
      indexdef 
    FROM pg_indexes 
    WHERE tablename = 'gps_tracking'
  `;
  
  console.log('\nIndexes on gps_tracking:');
  for (const idx of indexes) {
    console.log(`- ${idx.indexname}`);
    console.log(`  ${idx.indexdef}`);
  }
  
  // Check constraints
  const constraints = await sql`
    SELECT 
      conname, 
      contype 
    FROM pg_constraint 
    WHERE conrelid = 'gps_tracking'::regclass
  `;
  
  console.log('\nConstraints on gps_tracking:');
  for (const c of constraints) {
    console.log(`- ${c.conname} (${c.contype})`);
  }
  
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await sql.end();
}

