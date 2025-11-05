import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 10,
  ssl: { rejectUnauthorized: false }
});

// Получить все брони с данными в поле data
async function getBookingsWithData() {
  return await sql`
    SELECT id, data, car_id, client_id
    FROM bookings
    WHERE data IS NOT NULL
      AND data::text != '{}'
      AND data::text != 'null'
  `;
}

// Сохранение car/client через dynamic_upsert_entity
async function upsertEntity(tableName, rentprogId, data) {
  try {
    const dataJson = JSON.stringify(data);
    const result = await sql`
      SELECT * FROM dynamic_upsert_entity(
        ${tableName}::TEXT,
        ${rentprogId}::TEXT,
        ${dataJson}::JSONB
      )
    `.then(rows => rows[0]);
    
    return result;
  } catch (error) {
    console.error(`  ❌ Error upserting ${tableName} ${rentprogId}:`, error.message);
    return null;
  }
}

// Обновить car_id и client_id в booking
async function updateBookingReferences(bookingId, carUuid, clientUuid) {
  try {
    await sql`
      UPDATE bookings
      SET 
        car_id = COALESCE(${carUuid}, car_id),
        client_id = COALESCE(${clientUuid}, client_id),
        updated_at = NOW()
      WHERE id = ${bookingId}
    `;
    return true;
  } catch (error) {
    console.error(`  ❌ Error updating booking ${bookingId}:`, error.message);
    return false;
  }
}

// Обработка одной брони
async function processBooking(booking) {
  const bookingId = booking.id;
  let data;
  
  try {
    // Парсим data если это строка
    data = typeof booking.data === 'string' ? JSON.parse(booking.data) : booking.data;
  } catch (error) {
    console.error(`  ❌ Failed to parse data for booking ${bookingId}`);
    return { processed: false };
  }
  
  let carUuid = null;
  let clientUuid = null;
  
  // Обрабатываем car если есть
  if (data.car && data.car.id) {
    console.log(`  📦 Processing car ${data.car.id}...`);
    const carResult = await upsertEntity('cars', String(data.car.id), data.car);
    if (carResult) {
      carUuid = carResult.entity_id;
      console.log(`    ✅ Car ${data.car.id} → ${carUuid} (${carResult.created ? 'created' : 'updated'})`);
    }
  }
  
  // Обрабатываем client если есть
  if (data.client && data.client.id) {
    console.log(`  👤 Processing client ${data.client.id}...`);
    const clientResult = await upsertEntity('clients', String(data.client.id), data.client);
    if (clientResult) {
      clientUuid = clientResult.entity_id;
      console.log(`    ✅ Client ${data.client.id} → ${clientUuid} (${clientResult.created ? 'created' : 'updated'})`);
    }
  }
  
  // Обновляем ссылки в booking
  if (carUuid || clientUuid) {
    console.log(`  🔗 Updating booking ${bookingId} references...`);
    await updateBookingReferences(bookingId, carUuid, clientUuid);
    console.log(`    ✅ Booking ${bookingId} updated`);
  }
  
  return {
    processed: true,
    booking_id: bookingId,
    rentprog_id: data.id,
    car_created: carUuid ? true : false,
    client_created: clientUuid ? true : false
  };
}

// Главная функция
async function main() {
  console.log('🚀 Processing Existing Bookings');
  console.log('='.repeat(60));
  console.log('');
  
  // Получаем все брони с данными
  console.log('📋 Fetching bookings from database...');
  const bookings = await getBookingsWithData();
  console.log(`   Found ${bookings.length} bookings with data\n`);
  
  if (bookings.length === 0) {
    console.log('✅ No bookings to process');
    await sql.end();
    return;
  }
  
  let processed = 0;
  let errors = 0;
  let carsCreated = 0;
  let clientsCreated = 0;
  
  for (const booking of bookings) {
    console.log(`\n📌 Booking ${booking.id}:`);
    
    const result = await processBooking(booking);
    
    if (result.processed) {
      processed++;
      if (result.car_created) carsCreated++;
      if (result.client_created) clientsCreated++;
    } else {
      errors++;
    }
  }
  
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total bookings: ${bookings.length}`);
  console.log(`Processed: ${processed}`);
  console.log(`Errors: ${errors}`);
  console.log(`Cars created/updated: ${carsCreated}`);
  console.log(`Clients created/updated: ${clientsCreated}`);
  console.log('\n✅ Processing completed!');
  
  await sql.end();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

