/**
 * Анализ расхождений между RentProg и БД после синхронизации бронирований
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

// Токены для филиалов (из syncEmployeeCash.ts)
const TOKENS = {
  'service-center': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDA0MSwiZXhwIjoxNzY1MDgyMDQxLCJqdGkiOiI1ZDkwMDI2MC02NTE2LTQxYjctOTI4Ny1jODAyMjNiN2EwNTMifQ.oLMvW9mftfJ9Oivy2riQjx8uK12Ur6aaFy02sDs6DSc',
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDExMywiZXhwIjoxNzY1MDgyMTEzLCJqdGkiOiI0MmUxNzQ5Zi02MjEyLTRmOTMtOGM0Zi02ZWMwODUzYmUwYWQifQ.20oXaXcgK_hdofbUK3RGdQuPa0pGWtZTV4b42-A8oY4',
  'batumi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OCIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDE1NCwiZXhwIjoxNzY1MDgyMTU0LCJqdGkiOiI0MWUxMjRjOS01MDgxLTQ2NmMtOTUxNS0xNWEwMjE4ZDA1OTEifQ.l2MfCEf1LJLe-kCuF-MKyOMdhAmd3UWfzG7xECMy37o',
  'kutaisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDIwMiwiZXhwIjoxNzY1MDgyMjAyLCJqdGkiOiIxZWVlMWU2YS1kMTNhLTQwMzEtYjI2Mi04NGRiM2Y0ZmFiMGEifQ.xGIpTLumIwLxpitlLbeclqb9XBedY8jV1wCIuMP69Vs'
};

const BASE_URL = 'https://rentprog.net/api/v1/public';

async function getRequestToken(branch) {
  const companyToken = TOKENS[branch];
  if (!companyToken) {
    throw new Error(`Неизвестный филиал: ${branch}`);
  }

  const authUrl = `${BASE_URL}/get_token?company_token=${companyToken}`;
  
  const response = await fetch(authUrl, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Ошибка получения токена: ${response.status}`);
  }

  const data = await response.json();
  return data.token;
}

async function fetchAllBookings(branch, token) {
  const bookings = [];
  let page = 1;
  const perPage = 20;
  let hasMore = true;

  while (hasMore) {
    // Задержка между запросами (1.5 сек = 40 запросов/мин)
    if (page > 1) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    const url = `${BASE_URL}/all_bookings?page=${page}&per_page=${perPage}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`Ошибка получения бронирований (${branch}, page ${page}): ${response.status}`);
      break;
    }

    const data = await response.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      hasMore = false;
      break;
    }

    bookings.push(...data);

    if (data.length < perPage) {
      hasMore = false;
    } else {
      page++;
    }

    // Защита от бесконечного цикла
    if (page > 100) {
      console.warn(`Достигнут максимум страниц для ${branch}`);
      break;
    }
  }

  return bookings;
}

async function getBookingsFromDB(branch) {
  const bookings = await sql`
    SELECT 
      b.id,
      b.start_at,
      b.end_at,
      b.status,
      er.external_id as rentprog_id,
      b.branch_id,
      br.code as branch_code
    FROM bookings b
    JOIN external_refs er ON er.entity_id = b.id
    JOIN branches br ON br.id = b.branch_id
    WHERE er.entity_type = 'booking'
      AND er.system = 'rentprog'
      AND br.code = ${branch}
    ORDER BY er.external_id::INTEGER
  `;
  return bookings;
}

function parseRentProgDate(dateStr) {
  if (!dateStr) return null;
  
  // Формат RentProg: "25-01-2022 10:00"
  const match = dateStr.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/);
  if (match) {
    const [, day, month, year, hour, minute] = match;
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
  }
  
  return new Date(dateStr);
}

function compareDates(rpDate, dbDate) {
  if (!rpDate && !dbDate) return true;
  if (!rpDate || !dbDate) return false;
  
  const rp = new Date(rpDate);
  const db = new Date(dbDate);
  
  // Сравниваем с точностью до минуты
  return Math.abs(rp.getTime() - db.getTime()) < 60000;
}

async function analyzeBranch(branch) {
  console.log(`\n📊 Анализ филиала: ${branch}`);
  console.log('='.repeat(50));

  try {
    // Получаем токен
    const token = await getRequestToken(branch);
    console.log(`✓ Токен получен`);

    // Получаем данные из RentProg
    console.log(`📥 Загрузка бронирований из RentProg...`);
    const rpBookings = await fetchAllBookings(branch, token);
    console.log(`✓ Загружено из RentProg: ${rpBookings.length} бронирований`);

    // Получаем данные из БД
    console.log(`📥 Загрузка бронирований из БД...`);
    const dbBookings = await getBookingsFromDB(branch);
    console.log(`✓ Загружено из БД: ${dbBookings.length} бронирований`);

    // Создаем мапы для быстрого поиска
    const rpMap = new Map();
    rpBookings.forEach(b => {
      rpMap.set(String(b.id), b);
    });

    const dbMap = new Map();
    dbBookings.forEach(b => {
      dbMap.set(b.rentprog_id, b);
    });

    // Анализ расхождений
    const discrepancies = {
      missingInDB: [], // Есть в RentProg, нет в БД
      missingInRP: [], // Есть в БД, нет в RentProg
      dateMismatches: [], // Расхождения в датах
      statusMismatches: [] // Расхождения в статусах
    };

    // Проверяем бронирования из RentProg
    for (const [rpId, rpBooking] of rpMap.entries()) {
      const dbBooking = dbMap.get(rpId);

      if (!dbBooking) {
        discrepancies.missingInDB.push({
          rentprog_id: rpId,
          start_date: rpBooking.start_date,
          end_date: rpBooking.end_date,
          state: rpBooking.state || rpBooking.status
        });
        continue;
      }

      // Проверяем даты
      const rpStart = parseRentProgDate(rpBooking.start_date || rpBooking.start_at);
      const rpEnd = parseRentProgDate(rpBooking.end_date || rpBooking.end_at);
      
      if (!compareDates(rpStart, dbBooking.start_at) || !compareDates(rpEnd, dbBooking.end_at)) {
        discrepancies.dateMismatches.push({
          rentprog_id: rpId,
          rp_start: rpBooking.start_date || rpBooking.start_at,
          db_start: dbBooking.start_at,
          rp_end: rpBooking.end_date || rpBooking.end_at,
          db_end: dbBooking.end_at
        });
      }

      // Проверяем статусы
      const rpStatus = String(rpBooking.state || rpBooking.status || '').trim();
      const dbStatus = String(dbBooking.status || '').trim();
      
      if (rpStatus && dbStatus && rpStatus !== dbStatus) {
        discrepancies.statusMismatches.push({
          rentprog_id: rpId,
          rp_status: rpStatus,
          db_status: dbStatus
        });
      }
    }

    // Проверяем бронирования из БД (которых нет в RentProg)
    for (const [rpId, dbBooking] of dbMap.entries()) {
      if (!rpMap.has(rpId)) {
        discrepancies.missingInRP.push({
          rentprog_id: rpId,
          start_at: dbBooking.start_at,
          end_at: dbBooking.end_at,
          status: dbBooking.status
        });
      }
    }

    // Формируем отчет
    const report = {
      branch,
      rentprog_count: rpBookings.length,
      db_count: dbBookings.length,
      discrepancies: {
        missing_in_db: discrepancies.missingInDB.length,
        missing_in_rp: discrepancies.missingInRP.length,
        date_mismatches: discrepancies.dateMismatches.length,
        status_mismatches: discrepancies.statusMismatches.length
      },
      details: discrepancies
    };

    // Выводим результаты
    console.log(`\n📈 Статистика:`);
    console.log(`   RentProg: ${rpBookings.length} бронирований`);
    console.log(`   БД: ${dbBookings.length} бронирований`);
    console.log(`\n⚠️  Расхождения:`);
    console.log(`   Отсутствуют в БД: ${discrepancies.missingInDB.length}`);
    console.log(`   Отсутствуют в RentProg: ${discrepancies.missingInRP.length}`);
    console.log(`   Расхождения в датах: ${discrepancies.dateMismatches.length}`);
    console.log(`   Расхождения в статусах: ${discrepancies.statusMismatches.length}`);

    if (discrepancies.missingInDB.length > 0) {
      console.log(`\n❌ Отсутствуют в БД (первые 5):`);
      discrepancies.missingInDB.slice(0, 5).forEach(b => {
        console.log(`   - ID: ${b.rentprog_id}, ${b.start_date} → ${b.end_date}, статус: ${b.state}`);
      });
    }

    if (discrepancies.missingInRP.length > 0) {
      console.log(`\n⚠️  Отсутствуют в RentProg (первые 5):`);
      discrepancies.missingInRP.slice(0, 5).forEach(b => {
        console.log(`   - ID: ${b.rentprog_id}, ${b.start_at} → ${b.end_at}, статус: ${b.status}`);
      });
    }

    if (discrepancies.dateMismatches.length > 0) {
      console.log(`\n📅 Расхождения в датах (первые 3):`);
      discrepancies.dateMismatches.slice(0, 3).forEach(b => {
        console.log(`   - ID: ${b.rentprog_id}`);
        console.log(`     Start: RP=${b.rp_start} vs DB=${b.db_start}`);
        console.log(`     End: RP=${b.rp_end} vs DB=${b.db_end}`);
      });
    }

    if (discrepancies.statusMismatches.length > 0) {
      console.log(`\n📊 Расхождения в статусах (первые 3):`);
      discrepancies.statusMismatches.slice(0, 3).forEach(b => {
        console.log(`   - ID: ${b.rentprog_id}: RP="${b.rp_status}" vs DB="${b.db_status}"`);
      });
    }

    return report;

  } catch (error) {
    console.error(`❌ Ошибка при анализе филиала ${branch}:`, error.message);
    return {
      branch,
      error: error.message
    };
  }
}

async function main() {
  console.log('🔍 Анализ расхождений между RentProg и БД');
  console.log('='.repeat(50));

  const branches = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
  const reports = [];

  for (const branch of branches) {
    const report = await analyzeBranch(branch);
    reports.push(report);
    
    // Задержка между филиалами
    if (branch !== branches[branches.length - 1]) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Итоговый отчет
  console.log('\n\n' + '='.repeat(50));
  console.log('📊 ИТОГОВЫЙ ОТЧЕТ');
  console.log('='.repeat(50));

  let totalMissingInDB = 0;
  let totalMissingInRP = 0;
  let totalDateMismatches = 0;
  let totalStatusMismatches = 0;

  reports.forEach(report => {
    if (report.error) {
      console.log(`\n❌ ${report.branch}: Ошибка - ${report.error}`);
      return;
    }

    console.log(`\n${report.branch.toUpperCase()}:`);
    console.log(`   RentProg: ${report.rentprog_count}, БД: ${report.db_count}`);
    console.log(`   Расхождения: ${JSON.stringify(report.discrepancies, null, 2)}`);

    totalMissingInDB += report.discrepancies.missing_in_db;
    totalMissingInRP += report.discrepancies.missing_in_rp;
    totalDateMismatches += report.discrepancies.date_mismatches;
    totalStatusMismatches += report.discrepancies.status_mismatches;
  });

  console.log(`\n\n📈 ОБЩАЯ СТАТИСТИКА:`);
  console.log(`   Отсутствуют в БД: ${totalMissingInDB}`);
  console.log(`   Отсутствуют в RentProg: ${totalMissingInRP}`);
  console.log(`   Расхождения в датах: ${totalDateMismatches}`);
  console.log(`   Расхождения в статусах: ${totalStatusMismatches}`);

  await sql.end();
}

main().catch(console.error);

