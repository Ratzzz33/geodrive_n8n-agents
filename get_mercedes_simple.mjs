import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  const car = await sql`SELECT id FROM cars WHERE plate = 'OB700OB'`;
  if (car.length === 0) {
    console.log('Car not found!');
    process.exit(1);
  }
  
  const carId = car[0].id;
  
  // Current GPS data
  const gps = await sql`
    SELECT 
      starline_device_id,
      starline_alias,
      current_lat,
      current_lng,
      status,
      speed,
      last_activity,
      last_sync,
      google_maps_link
    FROM gps_tracking
    WHERE car_id = ${carId}
  `;
  
  if (gps.length > 0) {
    const g = gps[0];
    console.log('=== CURRENT GPS DATA ===');
    console.log('Device ID:', g.starline_device_id);
    console.log('Alias:', g.starline_alias);
    console.log('Coordinates:', g.current_lat + ', ' + g.current_lng);
    console.log('Status:', g.status);
    console.log('Speed:', g.speed, 'km/h');
    console.log('Last Activity:', g.last_activity);
    console.log('Last Sync:', g.last_sync);
    console.log('Google Maps:', g.google_maps_link);
    console.log('');
  }
  
  // Last 10 GPS events
  const events = await sql`
    SELECT 
      event_type,
      data,
      created_at
    FROM entity_timeline
    WHERE entity_type = 'car'
      AND entity_id = ${carId}
      AND event_type LIKE 'gps.%'
    ORDER BY created_at DESC
    LIMIT 10
  `;
  
  if (events.length > 0) {
    console.log('=== LAST 10 GPS EVENTS ===');
    events.forEach((e, i) => {
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      const lat = data.lat || data.current_lat;
      const lng = data.lng || data.current_lng;
      
      console.log((i+1) + '. ' + e.event_type + ' - ' + e.created_at);
      console.log('   Coords: ' + lat + ', ' + lng);
      console.log('   Status: ' + (data.status || 'N/A') + ', Speed: ' + (data.speed || 0) + ' km/h');
      console.log('   Maps: https://www.google.com/maps?q=' + lat + ',' + lng);
      console.log('');
    });
  } else {
    console.log('No GPS events found');
  }
  
} catch (error) {
  console.error('ERROR:', error.message);
} finally {
  await sql.end();
}

