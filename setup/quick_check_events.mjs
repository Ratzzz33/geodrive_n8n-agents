import postgres from 'postgres';

const sql = postgres(
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
  { max: 1, ssl: { rejectUnauthorized: false } }
);

try {
  // Get table structure
  const structure = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'events'
    ORDER BY ordinal_position
  `;
  
  console.log('Events table structure:');
  structure.forEach(col => {
    console.log(`  - ${col.column_name}: ${col.data_type}`);
  });
  
  // Get last event
  const lastEvent = await sql`SELECT * FROM events ORDER BY id DESC LIMIT 1`;
  
  if (lastEvent.length > 0) {
    console.log('\nLast event columns:', Object.keys(lastEvent[0]).join(', '));
  }
  
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await sql.end();
}

