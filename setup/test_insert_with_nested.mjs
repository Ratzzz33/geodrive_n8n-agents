import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function testInsertWithNested() {
  console.log('🧪 Testing INSERT with nested car/client\n');
  
  // Тестовые данные (как приходят с вебхука)
  const testRentprogId = `test_${Date.now()}`;
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
    console.log('1. Inserting test booking via dynamic_upsert_entity...');
    
    const result = await sql`
      SELECT * FROM dynamic_upsert_entity(
        'bookings'::TEXT,
        ${testRentprogId}::TEXT,
        ${JSON.stringify(testData)}::JSONB
      )
    `.then(rows => rows[0]);
    
    console.log(`   Created: ${result.entity_id}`);
    console.log(`   Is new: ${result.created}`);
    
    // Проверить, что триггер обработал car и client
    console.log('\n2. Checking if trigger processed car/client...');
    
    const booking = await sql`
      SELECT 
        id,
        car_id,
        client_id,
        start_date,
        data->>'id' as data_id,
        data->'car'->>'id' as car_in_data,
        data->'client'->>'id' as client_in_data
      FROM bookings
      WHERE id = ${result.entity_id}
    `.then(rows => rows[0]);
    
    console.log(`   car_id: ${booking.car_id || 'NULL'}`);
    console.log(`   client_id: ${booking.client_id || 'NULL'}`);
    console.log(`   start_date: ${booking.start_date || 'NULL'}`);
    console.log(`   data.id: ${booking.data_id}`);
    console.log(`   data.car.id: ${booking.car_in_data}`);
    console.log(`   data.client.id: ${booking.client_in_data}`);
    
    // Удалить тестовую бронь
    console.log('\n3. Cleaning up...');
    await sql`DELETE FROM bookings WHERE id = ${result.entity_id}`;
    await sql`DELETE FROM external_refs WHERE external_id = ${testRentprogId} AND entity_type = 'booking'`;
    
    console.log('   ✅ Done');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sql.end();
  }
}

testInsertWithNested();

