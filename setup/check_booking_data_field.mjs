#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkBookingData() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n🔍 Проверка поля data в booking 486033...\n');

  try {
    const result = await sql`
      SELECT 
        b.id,
        b.car_id,
        b.client_id,
        b.data IS NOT NULL as has_data,
        b.data->'car' IS NOT NULL as has_car,
        b.data->'client' IS NOT NULL as has_client,
        b.data->'car'->>'id' as car_rentprog_id,
        b.data->'client'->>'id' as client_rentprog_id
      FROM bookings b
      JOIN external_refs er ON er.entity_id = b.id
      WHERE er.system = 'rentprog' AND er.external_id = '486033'
      LIMIT 1;
    `;

    if (result.length === 0) {
      console.log('❌ Booking не найден');
      return;
    }

    const booking = result[0];
    console.log('📋 Booking найден:');
    console.log(`   ID: ${booking.id}`);
    console.log(`   car_id: ${booking.car_id || 'NULL'}`);
    console.log(`   client_id: ${booking.client_id || 'NULL'}`);
    console.log(`\n📦 Поле data:`);
    console.log(`   has_data: ${booking.has_data}`);
    console.log(`   has_car: ${booking.has_car}`);
    console.log(`   has_client: ${booking.has_client}`);
    console.log(`   car RentProg ID: ${booking.car_rentprog_id || 'NULL'}`);
    console.log(`   client RentProg ID: ${booking.client_rentprog_id || 'NULL'}`);

    if (!booking.has_data) {
      console.log('\n❌ ПРОБЛЕМА: Поле data пустое!');
      console.log('   Триггер не может обработать booking без data');
    } else if (!booking.has_car && !booking.has_client) {
      console.log('\n❌ ПРОБЛЕМА: В data нет вложенных car/client!');
    } else {
      console.log('\n✅ Данные есть, триггер должен был сработать');
      console.log('   Возможно, триггер не был активирован или упал с ошибкой');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkBookingData();

