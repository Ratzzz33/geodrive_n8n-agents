import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function testDirectInsert() {
  console.log('🧪 Testing DIRECT INSERT with trigger\n');
  
  const testData = {
    id: 999999,
    start_date: "10-11-2025 1:30",
    end_date: "18-11-2025 2:00",
    state: "Новая",
    price: 105,
    days: 8,
    total: 1060,
    deposit: 0,
    car: {
      id: 37407,
      car_name: "Volkswagen Tiguan",
      vin: "WVGAV3AX1EW519321"
    },
    client: {
      id: 368848,
      name: "Yelyzaveta",
      lastname: "Futorianska",
      phone: "+353852852351"
    }
  };
  
  try {
    console.log('1. Direct INSERT into bookings with data...');
    
    const testId = `gen_random_uuid()`;
    
    // Прямой INSERT с данными
    const result = await sql`
      INSERT INTO bookings (id, data)
      VALUES (gen_random_uuid(), ${JSON.stringify(testData)}::JSONB)
      RETURNING id, car_id, client_id, start_date, data
    `.then(rows => rows[0]);
    
    console.log(`   Created: ${result.id}`);
    console.log(`   car_id: ${result.car_id || 'NULL'}`);
    console.log(`   client_id: ${result.client_id || 'NULL'}`);
    console.log(`   start_date: ${result.start_date || 'NULL'}`);
    console.log(`   data type: ${typeof result.data}`);
    console.log(`   data.id: ${result.data?.id || 'NULL'}`);
    console.log(`   data.car.id: ${result.data?.car?.id || 'NULL'}`);
    console.log(`   data.client.id: ${result.data?.client?.id || 'NULL'}`);
    
    // Cleanup
    console.log('\n2. Cleaning up...');
    await sql`DELETE FROM bookings WHERE id = ${result.id}`;
    
    console.log('   ✅ Done');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sql.end();
  }
}

testDirectInsert();

