import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  const result = await sql`
    SELECT 
      device_id,
      alias,
      plate,
      avatar_url,
      matched,
      car_id
    FROM starline_devices
    WHERE plate = 'OB700OB'
  `;
  
  if (result.length > 0) {
    const r = result[0];
    console.log('=== Mercedes Benz GLE 350 (OB700OB) ===');
    console.log('Device ID:', r.device_id);
    console.log('Alias:', r.alias);
    console.log('Plate:', r.plate);
    console.log('Matched:', r.matched);
    console.log('Car ID:', r.car_id);
    console.log('Avatar URL:', r.avatar_url || 'NULL');
    console.log('');
    console.log('Avatar link:', r.avatar_url ? r.avatar_url : 'No avatar');
  } else {
    console.log('Not found');
  }
  
} catch (error) {
  console.error('ERROR:', error.message);
} finally {
  await sql.end();
}

