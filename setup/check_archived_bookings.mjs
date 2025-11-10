/**
 * Скрипт для проверки, существуют ли пропущенные бронирования в RentProg API
 * Проверяет несколько примеров бронирований с RentProg ID, но без branch_code
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkArchivedBookings() {
  try {
    console.log('🔍 Проверка архивных бронирований...\n');

    // Получаем примеры бронирований с RentProg ID, но без branch_code
    const bookingsWithoutBranch = await sql`
      SELECT 
        b.id,
        er.external_id as rentprog_id,
        b.updated_at
      FROM bookings b
      INNER JOIN external_refs er ON er.entity_type = 'booking' 
        AND er.entity_id = b.id 
        AND er.system = 'rentprog'
      WHERE er.branch_code IS NULL
      ORDER BY b.updated_at DESC
      LIMIT 10
    `;

    console.log(`📊 Найдено ${bookingsWithoutBranch.length} примеров бронирований без branch_code\n`);

    const branches = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
    let found = 0;
    let notFound = 0;
    let archived = 0;

    for (const booking of bookingsWithoutBranch) {
      const rentprogId = booking.rentprog_id;
      console.log(`\n🔍 Проверка бронирования RentProg ID: ${rentprogId}`);
      console.log(`   Booking ID: ${booking.id}`);
      console.log(`   Последнее обновление: ${new Date(booking.updated_at).toISOString()}`);

      let foundInBranch = null;
      let isArchived = false;

      // Пробуем найти в каждом филиале через прямой HTTP запрос
      // Используем токены филиалов
      const branchTokens = {
        'tbilisi': '91b83b93963633649f29a04b612bab3f9fbb0471b5928622',
        'batumi': '7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d',
        'kutaisi': '5599ebb7b94827fdfd49ca3a5b7e259cfa99d8ea78edeb50',
        'service-center': '5y4j4gcs75o9n5s1e2vrxx4a'
      };

      for (const branch of branches) {
        try {
          // Получаем токен
          const tokenResponse = await fetch(
            `https://rentprog.net/api/v1/public/get_token?company_token=${branchTokens[branch]}`
          );
          const tokenData = await tokenResponse.json();
          const requestToken = tokenData.token;

          // Пробуем разные endpoints
          const endpoints = [
            `/all_bookings?id=${rentprogId}`,
            `/booking/${rentprogId}`,
            `/bookings/${rentprogId}`,
          ];

          for (const endpoint of endpoints) {
            try {
              const response = await fetch(
                `https://rentprog.net/api/v1/public${endpoint}`,
                {
                  headers: {
                    'Authorization': requestToken,
                    'Accept': 'application/json'
                  }
                }
              );

              if (response.ok) {
                const data = await response.json();
                
                // Проверяем, что получили данные о бронировании
                if (data && (data.id || data.booking_id || (Array.isArray(data) && data.length > 0))) {
                  foundInBranch = branch;
                  console.log(`   ✅ Найдено в филиале: ${branch}`);
                  found++;
                  break;
                }
              }
            } catch (error) {
              // Продолжаем поиск
            }
          }

          if (foundInBranch) break;
        } catch (error) {
          // Продолжаем поиск в других филиалах
        }
      }

      if (!foundInBranch) {
        console.log(`   ❌ Не найдено ни в одном филиале`);
        notFound++;
        isArchived = true;
        archived++;
      }

      // Небольшая задержка между запросами
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n📊 Итоговая статистика:\n');
    console.log(`✅ Найдено в RentProg: ${found}`);
    console.log(`❌ Не найдено (возможно архивные): ${notFound}`);
    console.log(`📦 Всего проверено: ${bookingsWithoutBranch.length}`);

    if (archived > 0) {
      console.log(`\n⚠️  ${archived} бронирований, вероятно, являются архивными и не возвращаются API /all_bookings`);
    }

    await sql.end();
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    await sql.end();
    process.exit(1);
  }
}

checkArchivedBookings();

