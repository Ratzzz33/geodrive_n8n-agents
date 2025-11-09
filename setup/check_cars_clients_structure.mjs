import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  // 1. Cars structure
  console.log('=== CARS TABLE STRUCTURE ===');
  const carsColumns = await sql.unsafe(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'cars' 
    ORDER BY ordinal_position
  `);
  console.log(carsColumns);

  // 2. Cars sample data
  console.log('\n=== SAMPLE CARS DATA ===');
  const carsCount = await sql.unsafe(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE data IS NOT NULL) as with_data,
      COUNT(*) FILTER (WHERE data IS NULL) as without_data
    FROM cars
  `);
  console.log('Cars count:', carsCount[0]);
  
  const carsSample = await sql.unsafe(`
    SELECT id, code, model, plate, data 
    FROM cars 
    WHERE data IS NOT NULL
    LIMIT 1
  `);
  if (carsSample.length > 0) {
    console.log('\nSample car with data:');
    console.log(JSON.stringify(carsSample[0], null, 2));
  } else {
    console.log('No cars with data field');
  }

  // 3. Clients structure
  console.log('\n=== CLIENTS TABLE STRUCTURE ===');
  const clientsColumns = await sql.unsafe(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'clients' 
    ORDER BY ordinal_position
  `);
  console.log(clientsColumns);

  // 4. Clients sample data
  console.log('\n=== SAMPLE CLIENTS DATA ===');
  const clientsCount = await sql.unsafe(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE data IS NOT NULL) as with_data,
      COUNT(*) FILTER (WHERE data IS NULL) as without_data
    FROM clients
  `);
  console.log('Clients count:', clientsCount[0]);
  
  const clientsSample = await sql.unsafe(`
    SELECT id, name, email, phone, data 
    FROM clients 
    WHERE data IS NOT NULL
    LIMIT 1
  `);
  if (clientsSample.length > 0) {
    console.log('\nSample client with data:');
    console.log(JSON.stringify(clientsSample[0], null, 2));
  } else {
    console.log('No clients with data field');
  }

} finally {
  await sql.end();
}

