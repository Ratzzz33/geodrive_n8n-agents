import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('Running migration 0016: Fix UNIQUE CONSTRAINT for ON CONFLICT...');
    
    // Step 1: Drop partial unique index
    console.log('1) Dropping partial unique index...');
    await sql`
      DROP INDEX IF EXISTS gps_tracking_starline_device_id_unique
    `;
    console.log('   Index dropped');
    
    // Step 2: Add UNIQUE CONSTRAINT
    console.log('2) Adding UNIQUE CONSTRAINT NULLS NOT DISTINCT...');
    try {
      await sql`
        ALTER TABLE gps_tracking 
        ADD CONSTRAINT gps_tracking_starline_device_id_key 
        UNIQUE NULLS NOT DISTINCT (starline_device_id)
      `;
      console.log('   UNIQUE CONSTRAINT added');
    } catch (e) {
      if (e.code === '42P07') {
        console.log('   UNIQUE CONSTRAINT already exists');
      } else {
        throw e;
      }
    }
    
    // Step 3: Verify
    console.log('3) Verifying...');
    const constraints = await sql`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'gps_tracking'::regclass
        AND contype = 'u'
    `;
    
    console.log('\nUNIQUE constraints on gps_tracking:');
    for (const c of constraints) {
      console.log(`- ${c.conname}: ${c.definition}`);
    }
    
    console.log('\nMigration finished successfully');
  } catch (error) {
    console.error('Migration failed:', error.message);
    if (error.detail) {
      console.error('   Detail:', error.detail);
    }
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();

