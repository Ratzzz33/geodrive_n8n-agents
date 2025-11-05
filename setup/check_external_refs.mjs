import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkExternalRefs() {
  console.log('🔍 Checking external_refs for last 5 bookings\n');
  
  // Последние 5 броней
  const bookings = await sql`
    SELECT 
      b.id,
      b.data->>'id' as data_rentprog_id,
      b.start_date,
      b.created_at
    FROM bookings b
    ORDER BY b.created_at DESC
    LIMIT 5
  `;
  
  for (const booking of bookings) {
    console.log(`UUID: ${booking.id}`);
    console.log(`  Data RentProg ID: ${booking.data_rentprog_id || 'NULL'}`);
    console.log(`  start_date: ${booking.start_date || 'NULL'}`);
    
    // Найти external_ref
    const extRef = await sql`
      SELECT external_id, system, entity_type
      FROM external_refs
      WHERE entity_id = ${booking.id}
    `.then(rows => rows[0]);
    
    if (extRef) {
      console.log(`  External ref: ${extRef.system}/${extRef.external_id} (${extRef.entity_type})`);
    } else {
      console.log(`  External ref: NOT FOUND`);
    }
    console.log('');
  }
  
  // Статистика external_refs
  const stats = await sql`
    SELECT 
      COUNT(DISTINCT b.id) as total_bookings,
      COUNT(DISTINCT er.entity_id) as bookings_with_refs,
      COUNT(DISTINCT b.id) - COUNT(DISTINCT er.entity_id) as bookings_without_refs
    FROM bookings b
    LEFT JOIN external_refs er ON b.id = er.entity_id AND er.entity_type = 'booking'
  `.then(rows => rows[0]);
  
  console.log('📊 External refs statistics:');
  console.log(`   Total bookings: ${stats.total_bookings}`);
  console.log(`   With external_refs: ${stats.bookings_with_refs}`);
  console.log(`   Without external_refs: ${stats.bookings_without_refs}`);
  
  await sql.end();
}

checkExternalRefs().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

