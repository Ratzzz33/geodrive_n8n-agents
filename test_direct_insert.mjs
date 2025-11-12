import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('Testing INSERT with ON CONFLICT (starline_device_id)...');
  
  const testResult = await sql`
    INSERT INTO gps_tracking (
      car_id, starline_device_id, starline_alias,
      current_lat, current_lng, current_sat_qty, "current_timestamp",
      status, is_moving, distance_moved, speed,
      gps_level, gsm_level, ignition_on, engine_running, parking_brake,
      battery_voltage, last_activity, last_sync
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      999999999,
      'TEST_DEVICE',
      41.0, 44.0, 10, NOW(),
      'parking', FALSE, 0.0, 0.0,
      100, 80, FALSE, FALSE, TRUE,
      12.5, NOW(), NOW()
    )
    ON CONFLICT (starline_device_id) DO UPDATE SET
      starline_alias = EXCLUDED.starline_alias,
      last_sync = NOW()
    RETURNING id
  `;
  
  console.log('Success! Returned:', testResult);
  
  // Cleanup
  await sql`DELETE FROM gps_tracking WHERE starline_device_id = 999999999`;
  console.log('Test row deleted.');
  
} catch (error) {
  console.error('ERROR:', error.message);
  if (error.detail) {
    console.error('Detail:', error.detail);
  }
} finally {
  await sql.end();
}

