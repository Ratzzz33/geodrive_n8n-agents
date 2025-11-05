#!/usr/bin/env node
/**
 * Проверка последних executions workflow
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const BOOKING_ID = '486033';

async function checkRecent() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n🔍 Проверка последних событий для booking 486033...\n');

  try {
    // Последние события
    const events = await sql`
      SELECT id, ts, operation, processed
      FROM events
      WHERE rentprog_id = ${BOOKING_ID}
      ORDER BY ts DESC
      LIMIT 5;
    `;

    console.log('📊 Последние события:');
    events.forEach(e => {
      const time = new Date(e.ts).toLocaleTimeString('ru-RU');
      console.log(`   ${e.id}: ${time} - ${e.operation} (processed: ${e.processed})`);
    });

    // Booking в БД
    const booking = await sql`
      SELECT b.id, b.car_id, b.client_id, b.car_name
      FROM bookings b
      JOIN external_refs er ON er.entity_id = b.id
      WHERE er.system = 'rentprog' AND er.external_id = ${BOOKING_ID};
    `;

    if (booking.length > 0) {
      console.log(`\n📦 Booking в БД:`);
      console.log(`   ID: ${booking[0].id}`);
      console.log(`   Car ID: ${booking[0].car_id || 'NULL'}`);
      console.log(`   Client ID: ${booking[0].client_id || 'NULL'}`);
      console.log(`   Car Name: ${booking[0].car_name}`);
    } else {
      console.log('\n⚠️  Booking не найден в БД');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
}

checkRecent();

