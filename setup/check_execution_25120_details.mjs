#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔍 Проверка execution 25120 и сохраненных данных в БД...\n');
  
  // 1. Проверяем последние сохраненные брони
  console.log('📊 Последние 5 броней из БД:\n');
  
  const recentBookings = await sql`
    SELECT 
      rentprog_id,
      number,
      branch,
      car_name,
      car_code,
      car_id,
      rentprog_car_id,
      client_name,
      total,
      deposit,
      rental_cost,
      data->>'client_id' as rp_client_id,
      data->>'car_id' as rp_car_id_from_data,
      updated_at
    FROM bookings
    ORDER BY updated_at DESC
    LIMIT 5
  `;
  
  recentBookings.forEach((b, idx) => {
    console.log(`${idx + 1}. Бронь ${b.rentprog_id} (№${b.number})`);
    console.log(`   Филиал: ${b.branch}`);
    console.log(`   Машина: ${b.car_name} (${b.car_code})`);
    console.log(`   car_id (UUID): ${b.car_id || 'NULL'}`);
    console.log(`   rentprog_car_id: ${b.rentprog_car_id || 'NULL'}`);
    console.log(`   data->>'car_id': ${b.rp_car_id_from_data || 'NULL'}`);
    console.log(`   Клиент: ${b.client_name}`);
    console.log(`   data->>'client_id': ${b.rp_client_id || 'NULL'}`);
    console.log(`   Цены: total=${b.total}, deposit=${b.deposit}, rental_cost=${b.rental_cost}`);
    console.log(`   Обновлено: ${b.updated_at}`);
    console.log('');
  });
  
  // 2. Проверяем связи через external_refs
  console.log('🔗 Проверка связей через external_refs:\n');
  
  const carsWithRefs = await sql`
    SELECT 
      c.code,
      c.id as car_uuid,
      er.external_id as rentprog_car_id,
      er.system
    FROM cars c
    LEFT JOIN external_refs er ON er.entity_id = c.id AND er.entity_type = 'car' AND er.system = 'rentprog'
    WHERE c.code IS NOT NULL
    LIMIT 5
  `;
  
  console.log(`Машины с external_refs (всего ${carsWithRefs.length}):`);
  carsWithRefs.forEach(c => {
    console.log(`  ${c.code} → UUID: ${c.car_uuid} → RentProg ID: ${c.rentprog_car_id || 'НЕТ СВЯЗИ'}`);
  });
  
  // 3. Проверяем клиентов
  console.log('\n👥 Проверка клиентов:\n');
  
  const clientsWithRefs = await sql`
    SELECT 
      c.id as client_uuid,
      c.name,
      er.external_id as rentprog_client_id,
      er.system
    FROM clients c
    LEFT JOIN external_refs er ON er.entity_id = c.id AND er.entity_type = 'client' AND er.system = 'rentprog'
    LIMIT 5
  `;
  
  console.log(`Клиенты с external_refs (всего ${clientsWithRefs.length}):`);
  clientsWithRefs.forEach(c => {
    console.log(`  ${c.name} → UUID: ${c.client_uuid} → RentProg ID: ${c.rentprog_client_id || 'НЕТ СВЯЗИ'}`);
  });
  
  // 4. Проверяем заполненность важных полей в бронях
  console.log('\n📈 Статистика заполненности полей в таблице bookings:\n');
  
  const stats = await sql`
    SELECT 
      COUNT(*) as total_bookings,
      COUNT(car_id) as has_car_uuid,
      COUNT(rentprog_car_id) as has_rentprog_car_id,
      COUNT(client_id) as has_client_uuid,
      COUNT(data->>'client_id') as has_rp_client_id_in_data,
      COUNT(total) as has_total,
      COUNT(deposit) as has_deposit,
      COUNT(rental_cost) as has_rental_cost
    FROM bookings
    WHERE updated_at > NOW() - INTERVAL '1 hour'
  `;
  
  const s = stats[0];
  console.log(`Брони за последний час: ${s.total_bookings}`);
  console.log(`  car_id (UUID): ${s.has_car_uuid} (${(s.has_car_uuid / s.total_bookings * 100).toFixed(1)}%)`);
  console.log(`  rentprog_car_id: ${s.has_rentprog_car_id} (${(s.has_rentprog_car_id / s.total_bookings * 100).toFixed(1)}%)`);
  console.log(`  client_id (UUID): ${s.has_client_uuid} (${(s.has_client_uuid / s.total_bookings * 100).toFixed(1)}%)`);
  console.log(`  data->>'client_id': ${s.has_rp_client_id_in_data} (${(s.has_rp_client_id_in_data / s.total_bookings * 100).toFixed(1)}%)`);
  console.log(`  total: ${s.has_total} (${(s.has_total / s.total_bookings * 100).toFixed(1)}%)`);
  console.log(`  deposit: ${s.has_deposit} (${(s.has_deposit / s.total_bookings * 100).toFixed(1)}%)`);
  console.log(`  rental_cost: ${s.has_rental_cost} (${(s.has_rental_cost / s.total_bookings * 100).toFixed(1)}%)`);
  
  // 5. Проверяем примеры броней БЕЗ car_id (UUID)
  console.log('\n⚠️  Брони БЕЗ car_id (UUID связи):');
  
  const bookingsWithoutCarUuid = await sql`
    SELECT 
      rentprog_id,
      car_name,
      car_code,
      rentprog_car_id
    FROM bookings
    WHERE car_id IS NULL
    AND rentprog_car_id IS NOT NULL
    LIMIT 3
  `;
  
  if (bookingsWithoutCarUuid.length > 0) {
    bookingsWithoutCarUuid.forEach(b => {
      console.log(`  Бронь ${b.rentprog_id}: ${b.car_name} (${b.car_code}), RentProg car_id: ${b.rentprog_car_id}`);
    });
    console.log('\n  💡 Причина: машина не найдена в таблице cars по car_code');
  } else {
    console.log('  ✅ Все брони с rentprog_car_id имеют car_id (UUID связь)');
  }
  
  // 6. Проверяем можем ли мы связать клиентов
  console.log('\n🔄 Проверка возможности связывания клиентов:\n');
  
  const clientLinkage = await sql`
    SELECT 
      b.rentprog_id,
      b.client_name,
      b.data->>'client_id' as rp_client_id,
      c.id as client_uuid,
      c.name as client_name_in_db
    FROM bookings b
    LEFT JOIN external_refs er ON er.external_id = b.data->>'client_id' AND er.entity_type = 'client' AND er.system = 'rentprog'
    LEFT JOIN clients c ON c.id = er.entity_id
    WHERE b.data->>'client_id' IS NOT NULL
    AND b.updated_at > NOW() - INTERVAL '1 hour'
    LIMIT 3
  `;
  
  if (clientLinkage.length > 0) {
    clientLinkage.forEach(cl => {
      const linked = cl.client_uuid ? '✅ СВЯЗАН' : '❌ НЕ НАЙДЕН';
      console.log(`  Бронь ${cl.rentprog_id}: RentProg client_id=${cl.rp_client_id}`);
      console.log(`    ${linked} ${cl.client_uuid ? `→ UUID: ${cl.client_uuid}, Имя в БД: ${cl.client_name_in_db}` : ''}`);
    });
  }
  
  console.log('\n✅ Проверка завершена');
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

