#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔍 Проверка execution 25137 - поле data заполнено?\n');
  
  // Проверяем последние обновленные брони
  const recentBookings = await sql`
    SELECT 
      rentprog_id,
      number,
      client_name,
      car_name,
      total,
      deposit,
      rental_cost,
      data->>'client_id' as rp_client_id,
      data->>'car_id' as rp_car_id,
      data->>'first_name' as first_name,
      data->>'last_name' as last_name,
      data->>'location_start' as location_start,
      jsonb_object_keys(data) as data_keys_sample,
      updated_at
    FROM bookings
    WHERE updated_at > NOW() - INTERVAL '10 minutes'
    ORDER BY updated_at DESC
    LIMIT 3
  `;
  
  if (recentBookings.length === 0) {
    console.log('⚠️  Нет броней, обновленных за последние 10 минут');
    console.log('   Execution 25137 мог не обновить брони, или еще не отработал');
    process.exit(0);
  }
  
  console.log(`📊 Найдено ${recentBookings.length} броней за последние 10 минут:\n`);
  
  let hasData = false;
  
  recentBookings.forEach((b, idx) => {
    console.log(`${idx + 1}. Бронь ${b.rentprog_id} (№${b.number})`);
    console.log(`   Обновлена: ${b.updated_at}`);
    console.log(`   Клиент: ${b.client_name}`);
    console.log(`   Машина: ${b.car_name}`);
    console.log(`   Цены: total=${b.total}, deposit=${b.deposit}, rental=${b.rental_cost}`);
    
    if (b.rp_client_id || b.rp_car_id) {
      console.log(`   ✅ data ЗАПОЛНЕНО:`);
      console.log(`      - data->>'client_id': ${b.rp_client_id || 'NULL'}`);
      console.log(`      - data->>'car_id': ${b.rp_car_id || 'NULL'}`);
      console.log(`      - data->>'first_name': ${b.first_name || 'NULL'}`);
      console.log(`      - data->>'last_name': ${b.last_name || 'NULL'}`);
      console.log(`      - data->>'location_start': ${b.location_start ? b.location_start.slice(0, 50) : 'NULL'}`);
      hasData = true;
    } else {
      console.log(`   ❌ data ПУСТО (client_id и car_id NULL)`);
    }
    console.log('');
  });
  
  // Подсчитываем сколько ключей в data у первой брони
  const firstBooking = recentBookings[0];
  const dataKeysCount = await sql`
    SELECT jsonb_object_keys(data) as key
    FROM bookings
    WHERE rentprog_id = ${firstBooking.rentprog_id}
  `;
  
  console.log(`📋 Ключи в поле data первой брони (${firstBooking.rentprog_id}):`);
  console.log(`   Всего ключей: ${dataKeysCount.length}`);
  
  if (dataKeysCount.length > 0) {
    console.log(`   Примеры ключей (первые 20):`);
    dataKeysCount.slice(0, 20).forEach(k => {
      console.log(`     - ${k.key}`);
    });
    
    if (dataKeysCount.length > 20) {
      console.log(`     ... и еще ${dataKeysCount.length - 20} ключей`);
    }
  }
  
  console.log('');
  
  if (hasData) {
    console.log('✅ УСПЕХ: Поле data теперь заполняется!');
    console.log('   Все важные параметры брони сохраняются в JSONB.');
  } else {
    console.log('❌ ПРОБЛЕМА: Поле data все еще пусто');
    console.log('   Возможно execution 25137 еще не отработал');
  }
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

