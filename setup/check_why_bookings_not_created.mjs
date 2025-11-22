#!/usr/bin/env node

/**
 * Check why bookings are not created despite processed events
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const missingIds = ['515042', '515008', '514944', '514378', '513772', '511419'];

async function check() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Проверка почему брони не созданы...\n');

    // Проверить события для одной брони детально
    const bookingId = '515042';
    console.log(`1️⃣ Детальная проверка брони #${bookingId}:\n`);

    const events = await sql`
      SELECT 
        id,
        ts,
        type,
        event_name,
        entity_type,
        rentprog_id,
        ext_id,
        payload,
        metadata,
        processed,
        ok,
        reason
      FROM events
      WHERE (rentprog_id = ${bookingId} OR ext_id = ${bookingId})
        AND (entity_type = 'booking' OR type LIKE '%booking%' OR event_name LIKE '%booking%')
      ORDER BY ts ASC
    `;

    console.log(`Найдено событий: ${events.length}\n`);
    events.forEach((e, idx) => {
      console.log(`  [${idx + 1}] ID: ${e.id} | ${e.ts.toISOString()}`);
      console.log(`      Тип: ${e.type || e.event_name || 'NULL'}`);
      console.log(`      Entity: ${e.entity_type || 'NULL'}`);
      console.log(`      RentProg ID: ${e.rentprog_id || e.ext_id || 'NULL'}`);
      console.log(`      Обработано: ${e.processed ? '✅' : '❌'} | OK: ${e.ok ? '✅' : '❌'}`);
      if (e.reason) {
        console.log(`      Причина: ${e.reason.substring(0, 100)}...`);
      }
      if (e.payload) {
        const payload = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload;
        console.log(`      Payload keys: ${Object.keys(payload).join(', ')}`);
        if (payload.id) console.log(`      Payload.id: ${payload.id}`);
        if (payload.booking_id) console.log(`      Payload.booking_id: ${payload.booking_id}`);
      }
      console.log('');
    });

    // Проверить, есть ли бронь в bookings по данным из payload
    console.log('2️⃣ Проверка данных из payload:\n');
    if (events.length > 0 && events[0].payload) {
      const payload = typeof events[0].payload === 'string' ? JSON.parse(events[0].payload) : events[0].payload;
      console.log('Payload структура:');
      console.log(JSON.stringify(payload, null, 2).substring(0, 500));
      
      // Проверить, есть ли car_id в payload
      if (payload.car_id) {
        console.log(`\nCar ID в payload: ${payload.car_id}`);
        const carRef = await sql`
          SELECT entity_id
          FROM external_refs
          WHERE system = 'rentprog'
            AND entity_type = 'car'
            AND external_id = ${String(payload.car_id)}
          LIMIT 1
        `;
        if (carRef.length > 0) {
          console.log(`✅ Автомобиль найден в БД: ${carRef[0].entity_id}`);
        } else {
          console.log(`❌ Автомобиль НЕ найден в БД (RentProg Car ID: ${payload.car_id})`);
        }
      }
    }

    // Проверить последние созданные брони
    console.log('\n3️⃣ Последние созданные брони (для сравнения):\n');
    const recentBookings = await sql`
      SELECT 
        er.external_id as rentprog_booking_id,
        b.id,
        b.status,
        b.created_at,
        b.start_at
      FROM external_refs er
      JOIN bookings b ON b.id = er.entity_id
      WHERE er.system = 'rentprog'
        AND er.entity_type = 'booking'
        AND er.external_id::INTEGER >= 515000
      ORDER BY er.external_id::INTEGER DESC
      LIMIT 5
    `;

    if (recentBookings.length > 0) {
      console.log('Последние созданные брони (515xxx):');
      recentBookings.forEach((b, idx) => {
        console.log(`  [${idx + 1}] #${b.rentprog_booking_id} | Статус: ${b.status || 'NULL'} | Создана: ${b.created_at ? new Date(b.created_at).toISOString() : 'NULL'}`);
      });
    } else {
      console.log('❌ Нет броней 515xxx в БД');
    }

    // Итоговый вывод
    console.log('\n' + '═'.repeat(60));
    console.log('📊 ВЫВОД:\n');
    
    if (events.length > 0 && events[0].processed && events[0].ok) {
      console.log('⚠️ ПРОБЛЕМА: События обработаны, но брони не созданы');
      console.log('\nВозможные причины:');
      console.log('   1. handleRentProgEvent не создает брони при обработке событий');
      console.log('   2. Ошибка при создании external_refs для броней');
      console.log('   3. Брони создаются, но без external_refs');
      console.log('\n💡 Рекомендации:');
      console.log('   1. Проверить логи Jarvis API при обработке событий');
      console.log('   2. Проверить функцию handleRentProgEvent для броней');
      console.log('   3. Запустить ручную синхронизацию броней через API');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

check().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

