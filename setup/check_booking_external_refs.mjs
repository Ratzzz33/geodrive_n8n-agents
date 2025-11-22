#!/usr/bin/env node

/**
 * Check if bookings have external_refs to RentProg
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkRefs() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Проверка external_refs для броней автомобиля RV933RR...\n');

    // Найти car_id
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

    // Найти все брони для этого автомобиля
    const bookings = await sql`
      SELECT 
        b.id,
        b.status,
        b.start_at,
        b.end_at
      FROM bookings b
      WHERE b.car_id = ${carId}
      ORDER BY b.start_at DESC
    `;

    console.log(`Найдено броней: ${bookings.length}\n`);

    for (const booking of bookings) {
      console.log(`Бронь ${booking.id}:`);
      console.log(`  Статус: ${booking.status}`);
      console.log(`  Период: ${booking.start_at ? new Date(booking.start_at).toISOString() : 'NULL'} - ${booking.end_at ? new Date(booking.end_at).toISOString() : 'NULL'}`);

      // Проверить external_refs
      const refs = await sql`
        SELECT 
          system,
          external_id,
          branch_code
        FROM external_refs
        WHERE entity_type = 'booking'
          AND entity_id = ${booking.id}
      `;

      if (refs.length === 0) {
        console.log(`  ❌ Нет external_refs (бронь не связана с RentProg)`);
      } else {
        console.log(`  ✅ External refs:`);
        refs.forEach(ref => {
          console.log(`     - ${ref.system}: ${ref.external_id} (branch: ${ref.branch_code || 'NULL'})`);
        });
      }
      console.log('');
    }

    // Итоговая статистика
    console.log('═'.repeat(60));
    const stats = await sql`
      SELECT 
        COUNT(*) as total_bookings,
        COUNT(*) FILTER (WHERE er.id IS NOT NULL) as with_refs,
        COUNT(*) FILTER (WHERE er.id IS NULL) as without_refs
      FROM bookings b
      LEFT JOIN external_refs er ON er.entity_id = b.id
        AND er.entity_type = 'booking'
        AND er.system = 'rentprog'
      WHERE b.car_id = ${carId}
    `;

    const s = stats[0];
    console.log(`\n📊 Статистика:`);
    console.log(`Всего броней: ${s.total_bookings}`);
    console.log(`С external_refs: ${s.with_refs}`);
    console.log(`Без external_refs: ${s.without_refs}`);

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

checkRefs().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

