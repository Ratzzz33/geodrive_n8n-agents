import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('Running migration 0015...');
    
    // Step 1: delete duplicate starline_device_id rows
    console.log('1) Removing duplicate starline_device_id rows...');
    const deleteResult = await sql`
      DELETE FROM gps_tracking gt1
      WHERE gt1.id NOT IN (
        SELECT DISTINCT ON (starline_device_id) id
        FROM gps_tracking
        WHERE starline_device_id IS NOT NULL
        ORDER BY starline_device_id, last_sync DESC NULLS LAST, id DESC
      )
    `;
    console.log(`   Removed rows: ${deleteResult.count || 0}`);
    
    // Step 2: drop UNIQUE constraint on car_id
    console.log('2) Dropping UNIQUE constraint on car_id if present...');
    await sql`
      DO $$ 
      BEGIN 
        IF EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'gps_tracking_car_id_key'
        ) THEN
          ALTER TABLE gps_tracking DROP CONSTRAINT gps_tracking_car_id_key;
          RAISE NOTICE 'Удален UNIQUE constraint на car_id';
        END IF;
      END $$;
    `;
    console.log('   Constraint removed or not present');
    
    // Step 3: create unique index on starline_device_id
    console.log('3) Creating unique index on starline_device_id...');
    try {
      await sql`
        CREATE UNIQUE INDEX gps_tracking_starline_device_id_unique 
        ON gps_tracking(starline_device_id) 
        WHERE starline_device_id IS NOT NULL
      `;
      console.log('   Unique index created');
    } catch (e) {
      if (e.code === '42P07') {
        console.log('   Unique index already exists');
      } else {
        throw e;
      }
    }
    
    // Step 4: fix mismatched car references
    console.log('4) Fixing mismatched car_id records...');
    const updateResult = await sql`
      UPDATE gps_tracking gt
      SET car_id = sd.car_id
      FROM starline_devices sd
      WHERE gt.starline_device_id = sd.device_id
        AND sd.matched = TRUE
        AND sd.active = TRUE
        AND gt.car_id != sd.car_id
    `;
    console.log(`   Updated rows: ${updateResult.count || 0}`);
    
    console.log('Migration finished successfully');
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

