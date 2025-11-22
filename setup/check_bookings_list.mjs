#!/usr/bin/env node

/**
 * Check if bookings from RentProg are in database
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

// Список броней из запроса пользователя
const bookingIds = [
  '515042', '515008', '514944', '514378', '513772', '511419', '510646', '509606',
  '506221', '504551', '504202', '515310', '515285', '515271', '515201', '515117',
  '515049', '514919', '514480', '514303', '514030', '513985', '513928', '512915',
  '512491', '511974', '511520', '511081', '510611', '510551', '509921', '507714',
  '506720', '505704', '504892', '503932', '503551', '501779', '500500', '500183',
  '499567', '499331', '496563', '496130', '495958', '495850', '488927', '465359'
];

async function checkBookings() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log(`🔍 Проверка ${bookingIds.length} броней в БД...\n`);

    // Проверить все брони через external_refs
    const found = await sql`
      SELECT 
        er.external_id as rentprog_booking_id,
        er.entity_id as booking_id,
        b.status,
        b.start_at,
        b.end_at,
        c.plate as car_plate,
        c.model as car_model,
        er_car.external_id as rentprog_car_id
      FROM external_refs er
      JOIN bookings b ON b.id = er.entity_id
      LEFT JOIN cars c ON c.id = b.car_id
      LEFT JOIN external_refs er_car ON er_car.entity_id = b.car_id
        AND er_car.entity_type = 'car'
        AND er_car.system = 'rentprog'
      WHERE er.system = 'rentprog'
        AND er.entity_type = 'booking'
        AND er.external_id = ANY(${bookingIds})
      ORDER BY er.external_id::INTEGER DESC
    `;

    const foundIds = new Set(found.map(b => b.rentprog_booking_id));
    const missingIds = bookingIds.filter(id => !foundIds.has(id));

    console.log(`✅ Найдено в БД: ${found.length} из ${bookingIds.length}\n`);

    if (found.length > 0) {
      console.log('📋 Найденные брони:\n');
      found.forEach((booking, idx) => {
        const start = booking.start_at ? new Date(booking.start_at).toISOString() : 'NULL';
        const end = booking.end_at ? new Date(booking.end_at).toISOString() : 'NULL';
        console.log(`  [${idx + 1}] Бронь #${booking.rentprog_booking_id}`);
        console.log(`      Статус: ${booking.status || 'NULL'}`);
        console.log(`      Период: ${start} - ${end}`);
        console.log(`      Авто: ${booking.car_plate || 'NULL'} (${booking.car_model || 'NULL'}) | RentProg Car ID: ${booking.rentprog_car_id || 'NULL'}`);
        console.log('');
      });
    }

    if (missingIds.length > 0) {
      console.log(`\n❌ НЕ найдено в БД: ${missingIds.length} броней\n`);
      console.log('Список отсутствующих броней:');
      missingIds.forEach((id, idx) => {
        console.log(`  ${idx + 1}. #${id}`);
      });
    }

    // Статистика
    console.log('\n' + '═'.repeat(60));
    console.log('📊 СТАТИСТИКА:\n');
    console.log(`Всего проверено: ${bookingIds.length}`);
    console.log(`Найдено в БД: ${found.length} (${((found.length / bookingIds.length) * 100).toFixed(1)}%)`);
    console.log(`Отсутствует в БД: ${missingIds.length} (${((missingIds.length / bookingIds.length) * 100).toFixed(1)}%)`);

    // Проверить статусы найденных броней
    if (found.length > 0) {
      const statusCounts = {};
      found.forEach(b => {
        const status = b.status || 'NULL';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      console.log('\n📊 Статусы найденных броней:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });

      // Проверить текущие и будущие брони
      const now = new Date();
      const current = found.filter(b => {
        const start = b.start_at ? new Date(b.start_at) : null;
        const end = b.end_at ? new Date(b.end_at) : null;
        return start && end && start <= now && end >= now;
      });

      const future = found.filter(b => {
        const start = b.start_at ? new Date(b.start_at) : null;
        return start && start > now;
      });

      console.log(`\n📅 Текущие брони: ${current.length}`);
      console.log(`📅 Будущие брони: ${future.length}`);
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

