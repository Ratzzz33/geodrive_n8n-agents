import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('Checking UNIQUE constraints on gps_tracking...\n');
  
  const constraints = await sql`
    SELECT 
      conname AS constraint_name,
      contype AS constraint_type,
      pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'gps_tracking'::regclass
      AND contype IN ('u', 'p')
  `;
  
  console.log('UNIQUE/PRIMARY constraints:');
  for (const c of constraints) {
    console.log(`- ${c.constraint_name} (${c.constraint_type})`);
    console.log(`  ${c.definition}`);
  }
  
  console.log('\nChecking UNIQUE indexes...\n');
  
  const indexes = await sql`
    SELECT 
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename = 'gps_tracking'
      AND indexdef LIKE '%UNIQUE%'
  `;
  
  console.log('UNIQUE indexes:');
  for (const idx of indexes) {
    console.log(`- ${idx.indexname}`);
    console.log(`  ${idx.indexdef}`);
  }
  
} catch (error) {
  console.error('ERROR:', error.message);
} finally {
  await sql.end();
}

