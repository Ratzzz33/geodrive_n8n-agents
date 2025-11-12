import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('Running migration 0017: Add avatar_url to starline_devices...');
    
    // Step 1: Add column
    console.log('1) Adding avatar_url column...');
    await sql`
      ALTER TABLE starline_devices 
      ADD COLUMN IF NOT EXISTS avatar_url TEXT
    `;
    console.log('   Column added');
    
    // Step 2: Fill existing records from cars table
    console.log('2) Filling existing records from cars table...');
    const updateResult = await sql`
      UPDATE starline_devices sd
      SET avatar_url = c.avatar_url
      FROM cars c
      WHERE sd.car_id = c.id
        AND sd.matched = TRUE
        AND c.avatar_url IS NOT NULL
    `;
    console.log(`   Updated ${updateResult.count || 0} records`);
    
    // Step 3: Create index
    console.log('3) Creating index...');
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_starline_devices_avatar_url 
        ON starline_devices(avatar_url) 
        WHERE avatar_url IS NOT NULL
      `;
      console.log('   Index created');
    } catch (e) {
      if (e.code === '42P07') {
        console.log('   Index already exists');
      } else {
        throw e;
      }
    }
    
    // Step 4: Verify
    console.log('4) Verifying...');
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(avatar_url) as with_avatar
      FROM starline_devices
      WHERE matched = TRUE
    `;
    
    console.log(`\nStats:`);
    console.log(`- Total matched devices: ${stats[0].total}`);
    console.log(`- Devices with avatar_url: ${stats[0].with_avatar}`);
    
    // Show sample
    const samples = await sql`
      SELECT 
        device_id,
        alias,
        plate,
        avatar_url
      FROM starline_devices
      WHERE matched = TRUE
        AND avatar_url IS NOT NULL
      LIMIT 5
    `;
    
    if (samples.length > 0) {
      console.log(`\nSample records with avatar_url:`);
      for (const s of samples) {
        console.log(`- ${s.alias} (${s.plate}): ${s.avatar_url}`);
      }
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

