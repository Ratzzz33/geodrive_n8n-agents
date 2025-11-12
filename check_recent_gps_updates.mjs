import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('Checking recent GPS updates...\n');
  
  // Check recent updates
  const recentUpdates = await sql`
    SELECT 
      starline_device_id,
      starline_alias,
      last_sync,
      status,
      current_lat,
      current_lng
    FROM gps_tracking
    WHERE last_sync > NOW() - INTERVAL '10 minutes'
    ORDER BY last_sync DESC
    LIMIT 10
  `;
  
  console.log(`Found ${recentUpdates.length} GPS updates in last 10 minutes:`);
  for (const u of recentUpdates) {
    console.log(`- Device ${u.starline_device_id} (${u.starline_alias}): ${u.last_sync}`);
    console.log(`  Status: ${u.status}, Location: ${u.current_lat}, ${u.current_lng}`);
  }
  
  if (recentUpdates.length === 0) {
    console.log('\n⚠️ No GPS updates in last 10 minutes!');
    
    // Check last update time
    const lastUpdate = await sql`
      SELECT 
        MAX(last_sync) as last_update
      FROM gps_tracking
    `;
    
    console.log(`\nLast GPS update was at: ${lastUpdate[0].last_update}`);
  }
  
} catch (error) {
  console.error('ERROR:', error.message);
  if (error.detail) {
    console.error('Detail:', error.detail);
  }
} finally {
  await sql.end();
}

