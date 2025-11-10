/**
 * Скрипт для восстановления и обновления пропущенных бронирований
 * Использует /search_bookings для поиска и определения филиала
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

// Токены филиалов
const branchTokens = {
  'tbilisi': '91b83b93963633649f29a04b612bab3f9fbb0471b5928622',
  'batumi': '7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d',
  'kutaisi': '5599ebb7b94827fdfd49ca3a5b7e259cfa99d8ea78edeb50',
  'service-center': '5y4j4gcs75o9n5s1e2vrxx4a'
};

const branchList = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];

/**
 * Получить токен для филиала
 */
async function getToken(branch) {
  try {
    const response = await fetch(
      `https://rentprog.net/api/v1/public/get_token?company_token=${branchTokens[branch]}`
    );
    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error(`   ❌ Ошибка получения токена для ${branch}:`, error.message);
    return null;
  }
}

/**
 * Поиск бронирования через /search_bookings
 */
async function searchBooking(branch, rentprogId, token) {
  try {
    const response = await fetch(
      `https://rentprog.net/api/v1/public/search_bookings?query=${rentprogId}&page=1&per_page=10`,
      {
        headers: {
          'Authorization': token,
          'Accept': 'application/json'
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      
      // Проверяем разные форматы ответа
      let bookings = [];
      if (Array.isArray(data)) {
        bookings = data;
      } else if (data.data && Array.isArray(data.data)) {
        bookings = data.data;
      } else if (data.bookings && Array.isArray(data.bookings)) {
        bookings = data.bookings;
      }

      // Ищем бронирование с нужным ID
      const found = bookings.find(b => 
        String(b.id) === String(rentprogId) || 
        String(b.booking_id) === String(rentprogId)
      );

      if (found) {
        return { found: true, booking: found };
      }
    }
    return { found: false };
  } catch (error) {
    return { found: false, error: error.message };
  }
}

/**
 * Поиск бронирования через прямой запрос по ID
 */
async function findBookingById(branch, rentprogId, token) {
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
            'Authorization': token,
            'Accept': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        if (data && (data.id || data.booking_id)) {
          return { found: true, booking: data };
        }
        
        if (Array.isArray(data) && data.length > 0) {
          const found = data.find(b => 
            String(b.id) === String(rentprogId) || 
            String(b.booking_id) === String(rentprogId)
          );
          if (found) {
            return { found: true, booking: found };
          }
        }
      }
    } catch (error) {
      // Продолжаем пробовать другие endpoints
    }
  }

  return { found: false };
}

/**
 * Обновить branch_code в external_refs
 */
async function updateBranchCode(bookingId, branchCode) {
  try {
    await sql`
      UPDATE external_refs
      SET branch_code = ${branchCode},
          updated_at = NOW()
      WHERE entity_type = 'booking'
        AND entity_id = ${bookingId}
        AND system = 'rentprog'
    `;
    return true;
  } catch (error) {
    console.error(`   ❌ Ошибка обновления branch_code:`, error.message);
    return false;
  }
}

/**
 * Вызвать upsert через Jarvis API
 */
async function upsertBooking(rentprogId, branchCode) {
  try {
    const response = await fetch('http://46.224.17.15:3000/process-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        branch: branchCode,
        type: 'booking.updated',
        ext_id: String(rentprogId)
      })
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    } else {
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Основная функция
 */
async function restoreMissedBookings() {
  try {
    console.log('🚀 Начало восстановления пропущенных бронирований...\n');

    // Получаем все бронирования без branch_code, но с RentProg ID
    const bookings = await sql`
      SELECT 
        b.id as booking_id,
        er.external_id as rentprog_id,
        b.updated_at
      FROM bookings b
      INNER JOIN external_refs er ON er.entity_type = 'booking' 
        AND er.entity_id = b.id 
        AND er.system = 'rentprog'
      WHERE er.branch_code IS NULL
        AND er.external_id IS NOT NULL
      ORDER BY b.updated_at DESC
    `;

    const total = bookings.length;
    console.log(`📊 Найдено ${total} бронирований без branch_code\n`);

    if (total === 0) {
      console.log('✅ Нет бронирований для восстановления');
      await sql.end();
      return;
    }

    let processed = 0;
    let found = 0;
    let notFound = 0;
    let updatedCount = 0;
    let errors = 0;

    // Обрабатываем по батчам для видимости прогресса
    const batchSize = 10;
    
    for (let i = 0; i < bookings.length; i += batchSize) {
      const batch = bookings.slice(i, i + batchSize);
      
      console.log(`\n📦 Обработка батча ${Math.floor(i / batchSize) + 1} (${i + 1}-${Math.min(i + batchSize, total)} из ${total})...\n`);

      for (const booking of batch) {
        processed++;
        const rentprogId = booking.rentprog_id;
        const bookingId = booking.booking_id;

        process.stdout.write(`[${processed}/${total}] Проверка ${rentprogId}... `);

        let foundBranch = null;
        let bookingData = null;

        // Пробуем найти в каждом филиале
        for (const branch of branchList) {
          const token = await getToken(branch);
          if (!token) continue;

          // Сначала пробуем /search_bookings
          let result = await searchBooking(branch, rentprogId, token);
          
          // Если не найдено, пробуем прямой запрос
          if (!result.found) {
            result = await findBookingById(branch, rentprogId, token);
          }

          if (result.found) {
            foundBranch = branch;
            bookingData = result.booking;
            break;
          }

          // Задержка между запросами
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        if (foundBranch) {
          found++;
          process.stdout.write(`✅ найдено в ${foundBranch} `);

          // Обновляем branch_code
          const updated = await updateBranchCode(bookingId, foundBranch);
          if (updated) {
            process.stdout.write(`→ branch_code обновлен `);
            
            // Вызываем upsert через Jarvis API
            const upsertResult = await upsertBooking(rentprogId, foundBranch);
            if (upsertResult.success) {
              updatedCount++;
              process.stdout.write(`→ upsert выполнен ✅\n`);
            } else {
              process.stdout.write(`→ upsert ошибка: ${upsertResult.error} ⚠️\n`);
              errors++;
            }
          } else {
            process.stdout.write(`→ ошибка обновления branch_code ❌\n`);
            errors++;
          }
        } else {
          notFound++;
          process.stdout.write(`❌ не найдено\n`);
        }

        // Небольшая задержка между бронированиями
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Промежуточная статистика
      console.log(`\n📊 Промежуточная статистика:`);
      console.log(`   Обработано: ${processed}/${total}`);
      console.log(`   Найдено: ${found}`);
      console.log(`   Не найдено: ${notFound}`);
      console.log(`   Обновлено: ${updatedCount}`);
      console.log(`   Ошибок: ${errors}\n`);
    }

    // Финальная статистика
    console.log('\n' + '='.repeat(60));
    console.log('📊 ФИНАЛЬНАЯ СТАТИСТИКА');
    console.log('='.repeat(60));
    console.log(`Всего обработано: ${processed}`);
    console.log(`✅ Найдено в RentProg: ${found}`);
    console.log(`❌ Не найдено: ${notFound}`);
    console.log(`🔄 Обновлено (branch_code + upsert): ${updatedCount}`);
    console.log(`⚠️  Ошибок: ${errors}`);
    console.log('='.repeat(60) + '\n');

    await sql.end();
    
  } catch (error) {
    console.error('\n❌ Критическая ошибка:', error);
    await sql.end();
    process.exit(1);
  }
}

// Запуск
restoreMissedBookings();

