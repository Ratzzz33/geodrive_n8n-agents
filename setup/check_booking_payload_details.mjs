#!/usr/bin/env node

/**
 * Check booking payload details to understand why bookings are not created
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const missingIds = ['515042', '515008', '514944'];

async function check() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Детальная проверка payload броней...\n');

    for (const bookingId of missingIds) {
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`Бронь #${bookingId}:\n`);

      const events = await sql`
        SELECT 
          id,
          ts,
          type,
          event_name,
          payload,
          processed,
          ok,
          reason
        FROM events
        WHERE (rentprog_id = ${bookingId} OR ext_id = ${bookingId})
          AND (entity_type = 'booking' OR type LIKE '%booking%' OR event_name LIKE '%booking%')
        ORDER BY ts ASC
        LIMIT 1
      `;

      if (events.length === 0) {
        console.log('❌ События не найдены');
        continue;
      }

      const event = events[0];
      const payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;

      console.log(`Событие ID: ${event.id}`);
      console.log(`Тип: ${event.type || event.event_name || 'NULL'}`);
      console.log(`Обработано: ${event.processed ? '✅' : '❌'} | OK: ${event.ok ? '✅' : '❌'}`);
      if (event.reason) {
        console.log(`Причина: ${event.reason}`);
      }

      console.log('\n📋 Payload данные:');
      console.log(`   id: ${payload.id || 'NULL'}`);
      console.log(`   car_id: ${payload.car_id || 'NULL'}`);
      console.log(`   client_id: ${payload.client_id || 'NULL'}`);
      console.log(`   start_date: ${payload.start_date || 'NULL'}`);
      console.log(`   end_date: ${payload.end_date || 'NULL'}`);
      console.log(`   state: ${payload.state || 'NULL'}`);
      console.log(`   active: ${payload.active !== undefined ? payload.active : 'NULL'}`);

      // Проверить, есть ли car_id и client_id в БД
      if (payload.car_id) {
        const carRef = await sql`
          SELECT entity_id
          FROM external_refs
          WHERE system = 'rentprog'
            AND entity_type = 'car'
            AND external_id = ${String(payload.car_id)}
          LIMIT 1
        `;
        console.log(`\n🚗 Автомобиль (RentProg ID: ${payload.car_id}):`);
        if (carRef.length > 0) {
          console.log(`   ✅ Найден в БД: ${carRef[0].entity_id}`);
        } else {
          console.log(`   ❌ НЕ найден в БД`);
        }
      } else {
        console.log(`\n🚗 Автомобиль: ❌ car_id отсутствует в payload`);
      }

      if (payload.client_id) {
        const clientRef = await sql`
          SELECT entity_id
          FROM external_refs
          WHERE system = 'rentprog'
            AND entity_type = 'client'
            AND external_id = ${String(payload.client_id)}
          LIMIT 1
        `;
        console.log(`\n👤 Клиент (RentProg ID: ${payload.client_id}):`);
        if (clientRef.length > 0) {
          console.log(`   ✅ Найден в БД: ${clientRef[0].entity_id}`);
        } else {
          console.log(`   ❌ НЕ найден в БД`);
        }
      } else {
        console.log(`\n👤 Клиент: ❌ client_id отсутствует в payload`);
      }

      // Проверить, есть ли бронь в bookings без external_refs
      const bookingWithoutRef = await sql`
        SELECT 
          b.id,
          b.status,
          b.start_at,
          b.end_at,
          b.data
        FROM bookings b
        WHERE b.data::text LIKE ${`%${bookingId}%`}
           OR (b.data->>'id')::text = ${bookingId}
        LIMIT 1
      `;

      if (bookingWithoutRef.length > 0) {
        console.log(`\n📋 Бронь найдена БЕЗ external_refs:`);
        console.log(`   ID: ${bookingWithoutRef[0].id}`);
        console.log(`   Статус: ${bookingWithoutRef[0].status || 'NULL'}`);
      } else {
        console.log(`\n📋 Бронь: ❌ НЕ найдена в bookings`);
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('📊 ИТОГОВЫЙ ВЫВОД:\n');
    console.log('Проблема: События обработаны (processed=true, ok=true), но брони не созданы');
    console.log('\nВозможные причины:');
    console.log('   1. handleRentProgEvent не вызывается для booking событий');
    console.log('   2. Ошибка при создании брони (не логируется)');
    console.log('   3. Брони создаются, но без external_refs');
    console.log('   4. Проблема с парсингом payload (car_id/client_id отсутствуют)');

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

