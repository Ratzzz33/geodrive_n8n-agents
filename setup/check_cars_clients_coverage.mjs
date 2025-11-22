#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false },
  connect_timeout: 10
});

try {
  console.log('📊 Проверка покрытия cars и clients в БД...\n');
  
  // 1. Машины
  console.log('🚗 МАШИНЫ:');
  const carsInDb = await sql`SELECT COUNT(*) as count FROM cars`;
  const carRefsInDb = await sql`
    SELECT COUNT(*) as count FROM external_refs 
    WHERE entity_type = 'car' AND system = 'rentprog'
  `;
  console.log(`   Записей в cars: ${carsInDb[0].count}`);
  console.log(`   External refs для cars: ${carRefsInDb[0].count}`);
  
  // Проверка связей в bookings
  const bookingsWithCarId = await sql`
    SELECT COUNT(*) as count FROM bookings WHERE car_id IS NOT NULL
  `;
  const bookingsTotal = await sql`SELECT COUNT(*) as count FROM bookings`;
  const carLinkagePercent = ((bookingsWithCarId[0].count / bookingsTotal[0].count) * 100).toFixed(1);
  
  console.log(`   Брони с car_id (UUID): ${bookingsWithCarId[0].count} из ${bookingsTotal[0].count} (${carLinkagePercent}%)`);
  
  if (bookingsWithCarId[0].count === bookingsTotal[0].count) {
    console.log('   ✅ Все брони связаны с машинами!\n');
  } else {
    console.log('   ⚠️  Не все брони связаны с машинами\n');
  }
  
  // 2. Клиенты
  console.log('👥 КЛИЕНТЫ:');
  const clientsInDb = await sql`SELECT COUNT(*) as count FROM clients`;
  const clientRefsInDb = await sql`
    SELECT COUNT(*) as count FROM external_refs 
    WHERE entity_type = 'client' AND system = 'rentprog'
  `;
  console.log(`   Записей в clients: ${clientsInDb[0].count}`);
  console.log(`   External refs для clients: ${clientRefsInDb[0].count}`);
  
  // Проверка связей в bookings
  const bookingsWithClientId = await sql`
    SELECT COUNT(*) as count FROM bookings WHERE client_id IS NOT NULL
  `;
  const clientLinkagePercent = ((bookingsWithClientId[0].count / bookingsTotal[0].count) * 100).toFixed(1);
  
  console.log(`   Брони с client_id (UUID): ${bookingsWithClientId[0].count} из ${bookingsTotal[0].count} (${clientLinkagePercent}%)`);
  
  if (bookingsWithClientId[0].count === bookingsTotal[0].count) {
    console.log('   ✅ Все брони связаны с клиентами!\n');
  } else {
    console.log('   ⚠️  Не все брони связаны с клиентами\n');
  }
  
  // 3. Несвязанные брони
  console.log('🔍 НЕСВЯЗАННЫЕ БРОНИ:');
  
  // Брони без car_id
  const bookingsWithoutCar = await sql`
    SELECT 
      rentprog_id,
      car_name,
      car_code,
      rentprog_car_id,
      data->>'car_id' as data_car_id
    FROM bookings 
    WHERE car_id IS NULL
    ORDER BY updated_at DESC
    LIMIT 5
  `;
  
  if (bookingsWithoutCar.length > 0) {
    console.log(`\n   ❌ Примеры броней БЕЗ car_id (UUID):`);
    bookingsWithoutCar.forEach(b => {
      console.log(`      Бронь ${b.rentprog_id}: ${b.car_name} (${b.car_code})`);
      console.log(`         RentProg car_id: ${b.rentprog_car_id}`);
      console.log(`         data.car_id: ${b.data_car_id}`);
    });
  }
  
  // Брони без client_id
  const bookingsWithoutClient = await sql`
    SELECT 
      rentprog_id,
      client_name,
      client_category,
      data->>'client_id' as data_client_id
    FROM bookings 
    WHERE client_id IS NULL
    ORDER BY updated_at DESC
    LIMIT 5
  `;
  
  if (bookingsWithoutClient.length > 0) {
    console.log(`\n   ❌ Примеры броней БЕЗ client_id (UUID):`);
    bookingsWithoutClient.forEach(b => {
      console.log(`      Бронь ${b.rentprog_id}: ${b.client_name}`);
      console.log(`         data.client_id: ${b.data_client_id}`);
    });
  }
  
  // 4. Итоговая оценка
  console.log('\n' + '='.repeat(60));
  console.log('📈 ИТОГОВАЯ ОЦЕНКА:\n');
  
  if (bookingsWithCarId[0].count === bookingsTotal[0].count && 
      bookingsWithClientId[0].count === bookingsTotal[0].count) {
    console.log('🎉 ОТЛИЧНО! Все брони полностью связаны!');
    console.log('   - Все машины в БД');
    console.log('   - Все клиенты в БД');
    console.log('   - Snapshot workflows НЕ нужны!');
  } else {
    console.log('⚠️  ТРЕБУЕТСЯ ДЕЙСТВИЕ:');
    
    if (bookingsWithCarId[0].count < bookingsTotal[0].count) {
      const missingCars = bookingsTotal[0].count - bookingsWithCarId[0].count;
      console.log(`   - ${missingCars} броней без связи с машинами`);
      console.log('   - Нужен snapshot для cars ИЛИ обновление external_refs');
    }
    
    if (bookingsWithClientId[0].count < bookingsTotal[0].count) {
      const missingClients = bookingsTotal[0].count - bookingsWithClientId[0].count;
      console.log(`   - ${missingClients} броней без связи с клиентами`);
      console.log('   - Нужен snapshot для clients ИЛИ обновление external_refs');
    }
  }
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

