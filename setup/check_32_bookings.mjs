#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const bookingIds = [
  '515036', '514906', '513826', '513341', '512302', '511948', '511840', '511393',
  '504731', '504226', '515311', '515208', '515166', '515106', '514701', '514689',
  '514170', '513441', '512391', '511983', '511943', '511523', '510608', '510603',
  '508729', '508506', '507522', '507472', '499676', '492131', '483689', '474729'
];

async function checkBookings() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Проверка 32 броней в БД...\n');

    // Получаем брони через external_refs
    const foundBookings = await sql`
      SELECT 
        er.external_id as rentprog_id,
        b.id as booking_uuid,
        b.status,
        b.start_at,
        b.end_at,
        c.plate,
        c.model,
        er.branch_code as branch
      FROM external_refs er
      LEFT JOIN bookings b ON er.entity_id = b.id
      LEFT JOIN cars c ON b.car_id = c.id
      WHERE er.system = 'rentprog'
        AND er.entity_type = 'booking'
        AND er.external_id = ANY(${bookingIds})
      ORDER BY er.external_id DESC
    `;

    const found = new Set(foundBookings.map(b => b.rentprog_id));
    const missing = bookingIds.filter(id => !found.has(id));

    console.log(`✅ Найдено в БД: ${found.size} из ${bookingIds.length}\n`);

    if (found.size > 0) {
      console.log('📋 Найденные брони:\n');
      foundBookings.forEach((booking, idx) => {
        console.log(`  [${idx + 1}] Бронь #${booking.rentprog_id}`);
        console.log(`      Branch: ${booking.branch}`);
        console.log(`      Статус: ${booking.status}`);
        console.log(`      Период: ${booking.start_at} - ${booking.end_at}`);
        if (booking.plate) {
          console.log(`      Авто: ${booking.plate} (${booking.model})`);
        }
        console.log('');
      });
    }

    if (missing.length > 0) {
      console.log(`\n❌ Отсутствуют в БД (${missing.length}):\n`);
      missing.forEach((id, idx) => {
        console.log(`  [${idx + 1}] #${id}`);
      });
      console.log('');
    }

    console.log('════════════════════════════════════════════════════════════');
    console.log('📊 СТАТИСТИКА:\n');
    console.log(`Всего проверено: ${bookingIds.length}`);
    console.log(`Найдено в БД: ${found.size} (${(found.size / bookingIds.length * 100).toFixed(1)}%)`);
    console.log(`Отсутствует в БД: ${missing.length} (${(missing.length / bookingIds.length * 100).toFixed(1)}%)`);

    if (found.size > 0) {
      // Статистика по статусам
      const statuses = {};
      foundBookings.forEach(b => {
        statuses[b.status] = (statuses[b.status] || 0) + 1;
      });
      
      console.log('\n📊 Статусы найденных броней:');
      Object.entries(statuses).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });

      // Статистика по филиалам
      const branches = {};
      foundBookings.forEach(b => {
        branches[b.branch] = (branches[b.branch] || 0) + 1;
      });
      
      console.log('\n📍 По филиалам:');
      Object.entries(branches).forEach(([branch, count]) => {
        console.log(`   ${branch}: ${count}`);
      });
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkBookings();

