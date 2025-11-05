import postgres from 'postgres';
import fetch from 'node-fetch';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 10,
  ssl: { rejectUnauthorized: false }
});

// Конфигурация филиалов
const BRANCHES = [
  {
    code: 'tbilisi',
    name: 'Tbilisi',
    company_id: 9110,
    company_token: '91b83b93963633649f29a04b612bab3f9fbb0471b5928622'
  },
  {
    code: 'batumi',
    name: 'Batumi',
    company_id: 9247,
    company_token: '7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d'
  },
  {
    code: 'kutaisi',
    name: 'Kutaisi',
    company_id: 9360,
    company_token: '5599ebb7b94827fdfd49ca3a5b7e259cfa99d8ea78edeb50'
  },
  {
    code: 'service-center',
    name: 'Service Center',
    company_id: 11163,
    company_token: '5y4j4gcs75o9n5s1e2vrxx4a'
  }
];

const BASE_URL = 'https://rentprog.net/api/v1/public';

// Получение токена для RentProg API
async function getToken(companyToken) {
  const response = await fetch(`${BASE_URL}/get_token?company_token=${companyToken}`);
  
  if (!response.ok) {
    throw new Error(`Failed to get token: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.token;
}

// Получение активных броней (пагинация)
// RentProg API требует query минимум 3 символа
// Используем разные query для получения максимального покрытия
async function getActiveBookings(requestToken, query, page = 1) {
  const response = await fetch(`${BASE_URL}/search_bookings?query=${query}&page=${page}`, {
    headers: {
      'Authorization': `Bearer ${requestToken}`
    }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch bookings (${response.status}): ${errorText.substring(0, 200)}`);
  }
  
  const bookings = await response.json();
  return Array.isArray(bookings) ? bookings : [];
}

// Получение ПОЛНЫХ данных брони по ID
async function getFullBooking(requestToken, bookingId) {
  const response = await fetch(`${BASE_URL}/bookings/${bookingId}`, {
    headers: {
      'Authorization': `Bearer ${requestToken}`
    }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch booking ${bookingId} (${response.status}): ${errorText.substring(0, 200)}`);
  }
  
  return await response.json();
}

// Upsert car и получить UUID
async function upsertCar(carData) {
  if (!carData || !carData.id) return null;
  
  const rentprogId = String(carData.id);
  const dataJson = JSON.stringify(carData);
  
  try {
    const result = await sql`
      SELECT * FROM dynamic_upsert_entity(
        'cars'::TEXT,
        ${rentprogId}::TEXT,
        ${dataJson}::JSONB
      )
    `.then(rows => rows[0]);
    
    return result.entity_id;
  } catch (error) {
    console.error(`    ❌ Error upserting car ${rentprogId}:`, error.message);
    return null;
  }
}

// Upsert client и получить UUID
async function upsertClient(clientData) {
  if (!clientData || !clientData.id) return null;
  
  const rentprogId = String(clientData.id);
  const dataJson = JSON.stringify(clientData);
  
  try {
    const result = await sql`
      SELECT * FROM dynamic_upsert_entity(
        'clients'::TEXT,
        ${rentprogId}::TEXT,
        ${dataJson}::JSONB
      )
    `.then(rows => rows[0]);
    
    return result.entity_id;
  } catch (error) {
    console.error(`    ❌ Error upserting client ${rentprogId}:`, error.message);
    return null;
  }
}

// Сохранение booking с раскладкой полей
async function saveBooking(booking, branch) {
  const rentprogId = String(booking.id);
  
  try {
    // 1. Обработать car
    let carUuid = null;
    if (booking.car) {
      carUuid = await upsertCar(booking.car);
    }
    
    // 2. Обработать client
    let clientUuid = null;
    if (booking.client) {
      clientUuid = await upsertClient(booking.client);
    }
    
    // 3. Сохранить booking через dynamic_upsert_entity
    const dataJson = JSON.stringify(booking);
    
    const bookingResult = await sql`
      SELECT * FROM dynamic_upsert_entity(
        'bookings'::TEXT,
        ${rentprogId}::TEXT,
        ${dataJson}::JSONB
      )
    `.then(rows => rows[0]);
    
    const bookingId = bookingResult.entity_id;
    const isNew = bookingResult.created;
    
    // 4. Обновить дополнительные поля booking
    const startDate = booking.start_date_formatted || booking.start_date;
    const endDate = booking.end_date_formatted || booking.end_date;
    const state = booking.state;
    const price = booking.price;
    const days = booking.days;
    const total = booking.total;
    const deposit = booking.deposit;
    
    await sql`
      UPDATE bookings
      SET 
        car_id = COALESCE(${carUuid}, car_id),
        client_id = COALESCE(${clientUuid}, client_id),
        start_date = ${startDate}::TIMESTAMPTZ,
        end_date = ${endDate}::TIMESTAMPTZ,
        state = ${state},
        price = ${price}::NUMERIC,
        days = ${days}::NUMERIC,
        total = ${total}::NUMERIC,
        deposit = ${deposit}::NUMERIC,
        updated_at = NOW()
      WHERE id = ${bookingId}
    `;
    
    return { entity_id: bookingId, created: isNew };
    
  } catch (error) {
    console.error(`    ❌ Error saving booking ${rentprogId}:`, error.message);
    return null;
  }
}

// Импорт броней для одного филиала с использованием множественных query
async function importBranchBookings(branch) {
  console.log(`\n📍 ${branch.name} (${branch.code})`);
  console.log('='.repeat(50));
  
  try {
    // Получаем токен
    console.log('🔑 Getting token...');
    const requestToken = await getToken(branch.company_token);
    
    // Используем разные query для максимального покрытия
    const queries = ['2023', '2024', '2025', 'active'];
    const processedIds = new Set(); // Дедупликация
    
    let totalProcessed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    
    for (const query of queries) {
      console.log(`\n🔍 Query: "${query}"`);
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        console.log(`  📄 Page ${page}...`);
        
        const bookings = await getActiveBookings(requestToken, query, page);
        
        if (bookings.length === 0) {
          hasMore = false;
          break;
        }
        
        console.log(`    Found ${bookings.length} bookings`);
        
        // Фильтруем активные и дедуплицируем
        const activeBookings = bookings.filter(b => {
          const status = b.state?.toLowerCase() || '';
          const isActive = !['отменена', 'отклонена', 'cancelled', 'closed'].includes(status);
          const isNew = !processedIds.has(b.id);
          return isActive && isNew;
        });
        
        console.log(`    New active: ${activeBookings.length}`);
        
        for (const booking of activeBookings) {
          processedIds.add(booking.id);
          
          // Получить ПОЛНЫЕ данные брони
          let fullBooking;
          try {
            fullBooking = await getFullBooking(requestToken, booking.id);
          } catch (error) {
            console.log(`    ⚠️  Failed to fetch full data for ${booking.id}: ${error.message}`);
            continue;
          }
          
          const result = await saveBooking(fullBooking, branch);
          
          if (result) {
            totalProcessed++;
            if (result.created) {
              totalCreated++;
              console.log(`    ✅ Created: ${booking.id}`);
            } else {
              totalUpdated++;
              console.log(`    🔄 Updated: ${booking.id}`);
            }
          }
        }
        
        // Если вернулось меньше записей, чем обычно, значит это последняя страница
        if (bookings.length < 10) {
          hasMore = false;
        } else {
          page++;
        }
        
        // Небольшая задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    console.log(`\n✅ ${branch.name} completed:`);
    console.log(`   Total processed: ${totalProcessed}`);
    console.log(`   Created: ${totalCreated}`);
    console.log(`   Updated: ${totalUpdated}`);
    
    return { branch: branch.code, processed: totalProcessed, created: totalCreated, updated: totalUpdated };
    
  } catch (error) {
    console.error(`❌ Error in ${branch.name}:`, error.message);
    return { branch: branch.code, processed: 0, created: 0, updated: 0, error: error.message };
  }
}

// Главная функция
async function main() {
  console.log('🚀 Starting Active Bookings Import');
  console.log('==================================================\n');
  
  const results = [];
  
  for (const branch of BRANCHES) {
    const result = await importBranchBookings(branch);
    results.push(result);
  }
  
  console.log('\n\n📊 SUMMARY');
  console.log('==================================================');
  
  let grandTotal = 0;
  let grandCreated = 0;
  let grandUpdated = 0;
  
  for (const result of results) {
    console.log(`\n${result.branch}:`);
    console.log(`  Processed: ${result.processed}`);
    console.log(`  Created: ${result.created}`);
    console.log(`  Updated: ${result.updated}`);
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
    
    grandTotal += result.processed;
    grandCreated += result.created;
    grandUpdated += result.updated;
  }
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`TOTAL: ${grandTotal} bookings`);
  console.log(`Created: ${grandCreated}`);
  console.log(`Updated: ${grandUpdated}`);
  console.log(`\n✅ Import completed!`);
  
  await sql.end();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

