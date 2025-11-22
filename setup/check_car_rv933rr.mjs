#!/usr/bin/env node

/**
 * Check car RV933RR (RentProg ID 68976) data in database
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkCar() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Проверка автомобиля RV933RR (RentProg ID: 68976)...\n');

    // 1. Найти автомобиль через external_refs
    console.log('1️⃣ Поиск автомобиля в БД:\n');
    const carRef = await sql`
      SELECT 
        er.entity_id as car_id,
        er.external_id as rentprog_id,
        c.plate,
        c.model,
        c.data
      FROM external_refs er
      JOIN cars c ON c.id = er.entity_id
      WHERE er.system = 'rentprog'
        AND er.entity_type = 'car'
        AND er.external_id = '68976'
      LIMIT 1
    `;

    if (carRef.length === 0) {
      console.log('❌ Автомобиль НЕ найден в БД');
      console.log('   RentProg ID 68976 не связан с автомобилем в нашей БД');
      return;
    }

    const car = carRef[0];
    console.log('✅ Автомобиль найден:');
    console.log(`   ID в БД: ${car.car_id}`);
    console.log(`   RentProg ID: ${car.rentprog_id}`);
    console.log(`   Номер: ${car.plate || 'NULL'}`);
    console.log(`   Модель: ${car.model || 'NULL'}`);
    if (car.data) {
      const data = typeof car.data === 'string' ? JSON.parse(car.data) : car.data;
      console.log(`   Данные: ${JSON.stringify(data, null, 2).substring(0, 200)}...`);
    }

    // 2. Проверить брони для этого автомобиля
    console.log('\n2️⃣ Поиск броней для автомобиля:\n');
    const bookings = await sql`
      SELECT 
        b.id,
        b.status,
        b.start_date,
        b.end_date,
        er_booking.external_id as rentprog_booking_id,
        cl.name as client_name,
        cl.phone as client_phone
      FROM bookings b
      JOIN external_refs er_booking ON er_booking.entity_id = b.id
        AND er_booking.entity_type = 'booking'
        AND er_booking.system = 'rentprog'
      LEFT JOIN external_refs er_car ON er_car.entity_id = b.car_id
        AND er_car.entity_type = 'car'
        AND er_car.system = 'rentprog'
      LEFT JOIN clients cl ON cl.id = b.client_id
      WHERE er_car.external_id = '68976'
      ORDER BY b.start_date DESC
      LIMIT 20
    `;

    if (bookings.length === 0) {
      console.log('❌ Брони НЕ найдены');
      console.log('   Нет броней для автомобиля RV933RR');
    } else {
      console.log(`✅ Найдено броней: ${bookings.length}\n`);

      const now = new Date();
      let currentBooking = null;
      let nearestBooking = null;
      const futureBookings = [];

      bookings.forEach((booking, idx) => {
        const startDate = booking.start_date ? new Date(booking.start_date) : null;
        const endDate = booking.end_date ? new Date(booking.end_date) : null;
        
        const isActive = startDate && endDate && startDate <= now && endDate >= now;
        const isFuture = startDate && startDate > now;

        console.log(`  [${idx + 1}] Бронь #${booking.rentprog_booking_id || booking.id}`);
        console.log(`      Статус: ${booking.status || 'NULL'}`);
        console.log(`      Начало: ${startDate ? startDate.toISOString() : 'NULL'}`);
        console.log(`      Конец: ${endDate ? endDate.toISOString() : 'NULL'}`);
        console.log(`      Клиент: ${booking.client_name || 'NULL'} (${booking.client_phone || 'NULL'})`);
        console.log(`      ${isActive ? '✅ АКТИВНА СЕЙЧАС' : isFuture ? '📅 БУДУЩАЯ' : '❌ ПРОШЛАЯ'}`);
        console.log('');

        if (isActive) {
          currentBooking = booking;
        }
        if (isFuture && !nearestBooking) {
          nearestBooking = booking;
          futureBookings.push(booking);
        } else if (isFuture) {
          futureBookings.push(booking);
        }
      });

      // 3. Определить текущую и ближайшую бронь
      console.log('3️⃣ Текущая и ближайшая бронь:\n');
      
      if (currentBooking) {
        const start = new Date(currentBooking.start_date);
        const end = new Date(currentBooking.end_date);
        console.log('✅ Текущая бронь:');
        console.log(`   Бронь #${currentBooking.rentprog_booking_id || currentBooking.id}`);
        console.log(`   Период: ${start.toISOString()} - ${end.toISOString()}`);
        console.log(`   Клиент: ${currentBooking.client_name || 'NULL'}`);
      } else {
        console.log('❌ Текущая бронь: нет');
      }

      if (nearestBooking) {
        const start = new Date(nearestBooking.start_date);
        console.log('\n📅 Ближайшая бронь:');
        console.log(`   Бронь #${nearestBooking.rentprog_booking_id || nearestBooking.id}`);
        console.log(`   Начало: ${start.toISOString()}`);
        console.log(`   Клиент: ${nearestBooking.client_name || 'NULL'}`);
      } else {
        console.log('\n❌ Ближайшая бронь: нет');
      }

      // 4. Проверить через car_id напрямую
      console.log('\n4️⃣ Проверка через car_id напрямую:\n');
      const bookingsByCarId = await sql`
        SELECT 
          b.id,
          b.status,
          b.start_date,
          b.end_date,
          er.external_id as rentprog_booking_id
        FROM bookings b
        JOIN external_refs er ON er.entity_id = b.id
          AND er.entity_type = 'booking'
          AND er.system = 'rentprog'
        WHERE b.car_id = ${car.car_id}
        ORDER BY b.start_date DESC
        LIMIT 10
      `;

      if (bookingsByCarId.length > 0) {
        console.log(`Найдено броней через car_id: ${bookingsByCarId.length}`);
        const now = new Date();
        bookingsByCarId.forEach((b, idx) => {
          const start = b.start_date ? new Date(b.start_date) : null;
          const end = b.end_date ? new Date(b.end_date) : null;
          const isActive = start && end && start <= now && end >= now;
          const isFuture = start && start > now;
          console.log(`  [${idx + 1}] #${b.rentprog_booking_id || b.id} | ${start ? start.toISOString() : 'NULL'} - ${end ? end.toISOString() : 'NULL'} | ${isActive ? '✅ АКТИВНА' : isFuture ? '📅 БУДУЩАЯ' : '❌ ПРОШЛАЯ'}`);
        });
      } else {
        console.log('❌ Брони через car_id не найдены');
      }
    }

    // 5. Итоговый вывод
    console.log('\n' + '═'.repeat(60));
    console.log('📊 ИТОГОВЫЙ ВЫВОД:\n');
    
    if (carRef.length > 0) {
      const car = carRef[0];
      console.log(`🚗 Автомобиль: ${car.plate || 'NULL'} (RentProg ID: ${car.rentprog_id})`);
      console.log(`📋 Модель: ${car.model || 'NULL'}`);
      
      if (bookings.length > 0) {
        const now = new Date();
        const current = bookings.find(b => {
          const start = b.start_date ? new Date(b.start_date) : null;
          const end = b.end_date ? new Date(b.end_date) : null;
          return start && end && start <= now && end >= now;
        });
        const nearest = bookings.find(b => {
          const start = b.start_date ? new Date(b.start_date) : null;
          return start && start > now;
        });
        
        console.log(`📅 Текущая бронь: ${current ? `#${current.rentprog_booking_id || current.id}` : 'нет'}`);
        console.log(`📅 Ближайшая бронь: ${nearest ? `#${nearest.rentprog_booking_id || nearest.id} (${new Date(nearest.start_date).toISOString()})` : 'нет'}`);
      } else {
        console.log('📅 Текущая бронь: нет');
        console.log('📅 Ближайшая бронь: нет');
      }
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

checkCar().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

