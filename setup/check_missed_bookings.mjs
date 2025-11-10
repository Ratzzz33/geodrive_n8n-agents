/**
 * Скрипт для проверки бронирований, которые не были обновлены при последней синхронизации
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkMissedBookings() {
  try {
    console.log('🔍 Проверка бронирований, которые не были обновлены...\n');

    // Время последней синхронизации (примерно 19:14:43 UTC, но возьмем с запасом)
    // Синхронизация началась в ~18:33, завершилась в 19:14
    // Проверим бронирования, которые не обновлялись с 18:00 UTC
    const syncStartTime = new Date('2025-11-10T18:00:00Z');
    
    console.log(`⏰ Время последней синхронизации: ${syncStartTime.toISOString()}\n`);

    // 1. Найти все бронирования в БД
    const allBookings = await sql`
      SELECT 
        b.id,
        b.updated_at,
        er.external_id as rentprog_id,
        er.branch_code as branch
      FROM bookings b
      LEFT JOIN external_refs er ON er.entity_type = 'booking' 
        AND er.entity_id = b.id 
        AND er.system = 'rentprog'
      ORDER BY b.updated_at DESC
    `;

    console.log(`📊 Всего бронирований в БД: ${allBookings.length}\n`);

    // 2. Найти бронирования, которые не обновлялись с начала синхронизации
    const notUpdated = allBookings.filter(b => {
      const updatedAt = new Date(b.updated_at);
      return updatedAt < syncStartTime;
    });

    console.log(`⚠️  Бронирований, не обновленных с ${syncStartTime.toISOString()}: ${notUpdated.length}\n`);

    if (notUpdated.length > 0) {
      console.log('📋 Список не обновленных бронирований (первые 20):\n');
      notUpdated.slice(0, 20).forEach((booking, idx) => {
        console.log(`${idx + 1}. Booking ID: ${booking.id}`);
        console.log(`   RentProg ID: ${booking.rentprog_id || 'N/A'}`);
        console.log(`   Branch: ${booking.branch || 'N/A'}`);
        console.log(`   Последнее обновление: ${new Date(booking.updated_at).toISOString()}`);
        console.log('');
      });

      if (notUpdated.length > 20) {
        console.log(`... и еще ${notUpdated.length - 20} бронирований\n`);
      }
    }

    // 3. Проверить бронирования без связи с RentProg
    const withoutRentProgLink = allBookings.filter(b => !b.rentprog_id);
    
    console.log(`\n🔗 Бронирований без связи с RentProg: ${withoutRentProgLink.length}\n`);

    if (withoutRentProgLink.length > 0) {
      console.log('📋 Бронирования без RentProg ID (первые 10):\n');
      withoutRentProgLink.slice(0, 10).forEach((booking, idx) => {
        console.log(`${idx + 1}. Booking ID: ${booking.id}`);
        console.log(`   Последнее обновление: ${new Date(booking.updated_at).toISOString()}`);
        console.log('');
      });
    }

    // 4. Статистика по филиалам
    console.log('\n📊 Статистика по филиалам:\n');
    
    const branchStats = {};
    allBookings.forEach(b => {
      const branch = b.branch || 'unknown';
      if (!branchStats[branch]) {
        branchStats[branch] = { total: 0, notUpdated: 0 };
      }
      branchStats[branch].total++;
      if (new Date(b.updated_at) < syncStartTime) {
        branchStats[branch].notUpdated++;
      }
    });

    Object.entries(branchStats).forEach(([branch, stats]) => {
      const percentage = ((stats.notUpdated / stats.total) * 100).toFixed(1);
      console.log(`${branch}: ${stats.total} всего, ${stats.notUpdated} не обновлено (${percentage}%)`);
    });

    // 5. Сравнить с количеством обработанных в синхронизации
    console.log('\n📈 Сравнение с результатами синхронизации:\n');
    console.log(`Обработано в синхронизации: 2,020 бронирований`);
    console.log(`Всего в БД: ${allBookings.length} бронирований`);
    console.log(`Разница: ${allBookings.length - 2020} бронирований`);
    
    if (allBookings.length > 2020) {
      console.log(`\n⚠️  В БД больше бронирований, чем было обработано!`);
      console.log(`Возможные причины:`);
      console.log(`- Бронирования были созданы вручную`);
      console.log(`- Бронирования из других источников`);
      console.log(`- Бронирования были удалены/архивированы в RentProg`);
    }

    await sql.end();
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    await sql.end();
    process.exit(1);
  }
}

checkMissedBookings();

