#!/usr/bin/env node

/**
 * Detailed check of bookings for car RV933RR
 * Check both through external_refs and direct car_id
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkBookings() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Детальная проверка броней для RV933RR...\n');

    // 1. Найти car_id
    const carRef = await sql`
      SELECT entity_id as car_id
      FROM external_refs
      WHERE system = 'rentprog'
        AND entity_type = 'car'
        AND external_id = '68976'
      LIMIT 1
    `;

    if (carRef.length === 0) {
      console.log('❌ Автомобиль не найден');
      return;
    }

    const carId = carRef[0].car_id;
    console.log(`✅ Car ID: ${carId}\n`);

    // 2. Проверить брони через car_id
    console.log('1️⃣ Брони через car_id:\n');
    const bookingsByCarId = await sql`
      SELECT 
        b.id,
        b.status,
        b.start_at,
        b.end_at,
        er.external_id as rentprog_booking_id,
        b.data
      FROM bookings b
      LEFT JOIN external_refs er ON er.entity_id = b.id
        AND er.entity_type = 'booking'
        AND er.system = 'rentprog'
      WHERE b.car_id = ${carId}
      ORDER BY b.start_at DESC NULLS LAST
      LIMIT 20
    `;

    if (bookingsByCarId.length === 0) {
      console.log('❌ Брони через car_id не найдены');
    } else {
      console.log(`✅ Найдено броней: ${bookingsByCarId.length}\n`);
      
      const now = new Date();
      bookingsByCarId.forEach((b, idx) => {
        const startDate = b.start_at ? new Date(b.start_at) : null;
        const endDate = b.end_at ? new Date(b.end_at) : null;
        
        const isActive = startDate && endDate && startDate <= now && endDate >= now;
        const isFuture = startDate && startDate > now;
        const isPast = endDate && endDate < now;
        
        console.log(`  [${idx + 1}] Бронь #${b.rentprog_booking_id || b.id}`);
        console.log(`      Статус: ${b.status || 'NULL'}`);
        console.log(`      Начало: ${startDate ? startDate.toISOString() : 'NULL'}`);
        console.log(`      Конец: ${endDate ? endDate.toISOString() : 'NULL'}`);
        if (b.data) {
          const data = typeof b.data === 'string' ? JSON.parse(b.data) : b.data;
          if (data.issue_planned || data.return_planned) {
            console.log(`      issue_planned: ${data.issue_planned || 'NULL'}`);
            console.log(`      return_planned: ${data.return_planned || 'NULL'}`);
          }
        }
        console.log(`      ${isActive ? '✅ АКТИВНА СЕЙЧАС' : isFuture ? '📅 БУДУЩАЯ' : isPast ? '❌ ПРОШЛАЯ' : '❓ НЕИЗВЕСТНО'}`);
        console.log('');
      });
    }

    // 3. Проверить все брони с этим car_id через external_refs
    console.log('2️⃣ Брони через external_refs (car_id в bookings):\n');
    const bookingsByRefs = await sql`
      SELECT 
        b.id,
        b.status,
        b.start_at,
        b.end_at,
        er_booking.external_id as rentprog_booking_id,
        er_car.external_id as rentprog_car_id
      FROM bookings b
      JOIN external_refs er_booking ON er_booking.entity_id = b.id
        AND er_booking.entity_type = 'booking'
        AND er_booking.system = 'rentprog'
      JOIN external_refs er_car ON er_car.entity_id = b.car_id
        AND er_car.entity_type = 'car'
        AND er_car.system = 'rentprog'
      WHERE er_car.external_id = '68976'
      ORDER BY b.start_at DESC NULLS LAST
      LIMIT 20
    `;

    if (bookingsByRefs.length === 0) {
      console.log('❌ Брони через external_refs не найдены');
    } else {
      console.log(`✅ Найдено броней: ${bookingsByRefs.length}\n`);
    }

    // 4. Итоговый вывод
    console.log('\n' + '═'.repeat(60));
    console.log('📊 ИТОГОВЫЙ ВЫВОД:\n');
    
    const allBookings = bookingsByCarId.length > 0 ? bookingsByCarId : bookingsByRefs;
    
    if (allBookings.length === 0) {
      console.log('✅ Данные верны:');
      console.log('   📅 Текущая бронь: нет');
      console.log('   📅 Ближайшая бронь: нет');
    } else {
      const now = new Date();
      const current = allBookings.find(b => {
        const startDate = b.start_at ? new Date(b.start_at) : null;
        const endDate = b.end_at ? new Date(b.end_at) : null;
        return startDate && endDate && startDate <= now && endDate >= now;
      });
      
      const future = allBookings
        .filter(b => {
          return b.start_at && new Date(b.start_at) > now;
        })
        .sort((a, b) => {
          const aStart = new Date(a.start_at);
          const bStart = new Date(b.start_at);
          return aStart - bStart;
        })[0];
      
      console.log(`📅 Текущая бронь: ${current ? `#${current.rentprog_booking_id || current.id}` : 'нет'}`);
      console.log(`📅 Ближайшая бронь: ${future ? `#${future.rentprog_booking_id || future.id} (${new Date(future.start_at).toISOString()})` : 'нет'}`);
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

checkBookings().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

