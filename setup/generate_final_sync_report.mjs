/**
 * Генерация финального отчета о синхронизации бронирований
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

// Результаты последней синхронизации
const syncResults = {
  "success": true,
  "timestamp": "2025-11-10T12:55:39.297Z",
  "summary": {
    "total_bookings": 40,
    "total_created": 0,
    "total_updated": 40,
    "total_errors": 0
  },
  "per_branch": [
    {"branch": "tbilisi", "total": 10, "created": 0, "updated": 10, "errors": 0},
    {"branch": "batumi", "total": 10, "created": 0, "updated": 10, "errors": 0},
    {"branch": "kutaisi", "total": 10, "created": 0, "updated": 10, "errors": 0},
    {"branch": "service-center", "total": 10, "created": 0, "updated": 10, "errors": 0}
  ]
};

async function generateReport() {
  console.log('📊 ФИНАЛЬНЫЙ ОТЧЕТ О СИНХРОНИЗАЦИИ БРОНИРОВАНИЙ');
  console.log('='.repeat(70));
  console.log(`Время синхронизации: ${new Date(syncResults.timestamp).toLocaleString('ru-RU')}`);
  console.log('='.repeat(70));

  // Статистика по филиалам
  const branchStats = await sql`
    SELECT 
      br.code as branch,
      COUNT(DISTINCT b.id) as total_bookings,
      COUNT(DISTINCT CASE WHEN b.updated_at > NOW() - INTERVAL '10 minutes' THEN b.id END) as recently_updated,
      COUNT(DISTINCT CASE WHEN b.status IS NOT NULL THEN b.id END) as with_status,
      COUNT(DISTINCT CASE WHEN b.start_at IS NOT NULL THEN b.id END) as with_start_date,
      COUNT(DISTINCT CASE WHEN b.end_at IS NOT NULL THEN b.id END) as with_end_date
    FROM bookings b
    JOIN branches br ON br.id = b.branch_id
    JOIN external_refs er ON er.entity_id = b.id
    WHERE er.entity_type = 'booking' AND er.system = 'rentprog'
    GROUP BY br.code
    ORDER BY br.code
  `;

  // Общая статистика
  const totalStats = await sql`
    SELECT 
      COUNT(DISTINCT b.id) as total,
      COUNT(DISTINCT CASE WHEN b.updated_at > NOW() - INTERVAL '10 minutes' THEN b.id END) as updated_last_10min,
      COUNT(DISTINCT CASE WHEN b.status IS NOT NULL THEN b.id END) as with_status,
      COUNT(DISTINCT CASE WHEN b.start_at IS NOT NULL AND b.end_at IS NOT NULL THEN b.id END) as complete_dates,
      COUNT(DISTINCT CASE WHEN b.car_id IS NOT NULL THEN b.id END) as with_car,
      COUNT(DISTINCT CASE WHEN b.client_id IS NOT NULL THEN b.id END) as with_client
    FROM bookings b
    JOIN external_refs er ON er.entity_id = b.id
    WHERE er.entity_type = 'booking' AND er.system = 'rentprog'
  `;

  // Последние обновленные
  const recentlyUpdated = await sql`
    SELECT 
      er.external_id as rentprog_id,
      br.code as branch,
      b.status,
      b.start_at,
      b.end_at,
      b.updated_at
    FROM bookings b
    JOIN external_refs er ON er.entity_id = b.id
    JOIN branches br ON br.id = b.branch_id
    WHERE er.entity_type = 'booking' 
      AND er.system = 'rentprog'
      AND b.updated_at > NOW() - INTERVAL '10 minutes'
    ORDER BY b.updated_at DESC
    LIMIT 20
  `;

  console.log('\n📈 РЕЗУЛЬТАТЫ СИНХРОНИЗАЦИИ:');
  console.log(`   ✅ Статус: ${syncResults.success ? 'Успешно' : 'Ошибка'}`);
  console.log(`   📦 Всего обработано: ${syncResults.summary.total_bookings} бронирований`);
  console.log(`   ➕ Создано новых: ${syncResults.summary.total_created}`);
  console.log(`   🔄 Обновлено существующих: ${syncResults.summary.total_updated}`);
  console.log(`   ❌ Ошибок: ${syncResults.summary.total_errors}`);

  console.log('\n📋 ПО ФИЛИАЛАМ:');
  syncResults.per_branch.forEach(branch => {
    console.log(`   ${branch.branch.toUpperCase()}:`);
    console.log(`      Всего синхронизировано: ${branch.total}`);
    console.log(`      Создано: ${branch.created}, Обновлено: ${branch.updated}, Ошибок: ${branch.errors}`);
  });

  console.log('\n📊 СТАТИСТИКА В БД:');
  console.log(`   Всего бронирований в БД: ${totalStats[0].total}`);
  console.log(`   Обновлено за последние 10 минут: ${totalStats[0].updated_last_10min}`);
  console.log(`   С полными данными:`);
  console.log(`      Со статусом: ${totalStats[0].with_status}`);
  console.log(`      С датами (start + end): ${totalStats[0].complete_dates}`);
  console.log(`      С авто: ${totalStats[0].with_car}`);
  console.log(`      С клиентом: ${totalStats[0].with_client}`);

  console.log('\n📋 ПО ФИЛИАЛАМ В БД:');
  branchStats.forEach(branch => {
    console.log(`   ${branch.branch.toUpperCase()}:`);
    console.log(`      Всего: ${branch.total_bookings}`);
    console.log(`      Обновлено за 10 мин: ${branch.recently_updated}`);
    console.log(`      Со статусом: ${branch.with_status}`);
    console.log(`      С датами: ${branch.with_start_date} start, ${branch.with_end_date} end`);
  });

  console.log('\n🔄 ПОСЛЕДНИЕ ОБНОВЛЕННЫЕ БРОНИРОВАНИЯ (топ-20):');
  recentlyUpdated.forEach((booking, idx) => {
    console.log(`   ${idx + 1}. RP ID: ${booking.rentprog_id}, Филиал: ${booking.branch}`);
    console.log(`      Статус: ${booking.status || 'N/A'}`);
    console.log(`      Даты: ${booking.start_at ? new Date(booking.start_at).toLocaleDateString('ru-RU') : 'N/A'} → ${booking.end_at ? new Date(booking.end_at).toLocaleDateString('ru-RU') : 'N/A'}`);
    console.log(`      Обновлено: ${new Date(booking.updated_at).toLocaleString('ru-RU')}`);
  });

  // Анализ расхождений
  console.log('\n⚠️  АНАЛИЗ РАСХОЖДЕНИЙ:');
  
  const totalInRP = syncResults.summary.total_bookings;
  const totalInDB = totalStats[0].total;
  const discrepancy = totalInDB - totalInRP;

  if (discrepancy > 0) {
    console.log(`   ⚠️  В БД больше бронирований, чем синхронизировано: +${discrepancy}`);
    console.log(`      Причина: В БД есть исторические/архивные данные, которые не возвращаются endpoint /all_bookings`);
  } else if (discrepancy < 0) {
    console.log(`   ⚠️  В RentProg больше бронирований, чем в БД: ${Math.abs(discrepancy)}`);
    console.log(`      Возможные причины:`);
    console.log(`      - Ошибки при синхронизации`);
    console.log(`      - Бронирования были удалены из RentProg после синхронизации`);
  } else {
    console.log(`   ✅ Количество совпадает: ${totalInRP} = ${totalInDB}`);
  }

  // Проверка качества данных
  const incompleteData = totalStats[0].total - totalStats[0].complete_dates;
  if (incompleteData > 0) {
    console.log(`\n   ⚠️  Найдено ${incompleteData} бронирований с неполными данными (без дат или статуса)`);
  }

  const withoutCar = totalStats[0].total - totalStats[0].with_car;
  const withoutClient = totalStats[0].total - totalStats[0].with_client;
  
  if (withoutCar > 0 || withoutClient > 0) {
    console.log(`   ⚠️  Бронирования без связей:`);
    if (withoutCar > 0) console.log(`      Без авто: ${withoutCar}`);
    if (withoutClient > 0) console.log(`      Без клиента: ${withoutClient}`);
  }

  // Итоговый вывод
  console.log('\n' + '='.repeat(70));
  console.log('✅ ИТОГОВЫЙ ОТЧЕТ');
  console.log('='.repeat(70));
  console.log(`\nСинхронизация выполнена: ${syncResults.success ? '✅ УСПЕШНО' : '❌ С ОШИБКАМИ'}`);
  console.log(`\nОбработано бронирований: ${syncResults.summary.total_bookings}`);
  console.log(`   - Создано: ${syncResults.summary.total_created}`);
  console.log(`   - Обновлено: ${syncResults.summary.total_updated}`);
  console.log(`   - Ошибок: ${syncResults.summary.total_errors}`);
  
  console.log(`\nТекущее состояние БД:`);
  console.log(`   - Всего бронирований: ${totalStats[0].total}`);
  console.log(`   - Обновлено за последние 10 минут: ${totalStats[0].updated_last_10min}`);
  console.log(`   - С полными данными: ${totalStats[0].complete_dates}`);
  
  if (syncResults.summary.total_errors === 0 && totalStats[0].updated_last_10min === syncResults.summary.total_updated) {
    console.log(`\n✅ Все данные синхронизированы корректно!`);
  } else {
    console.log(`\n⚠️  Обнаружены проблемы, требующие внимания.`);
  }

  console.log(`\n📝 Примечание: Endpoint /all_bookings возвращает только активные и неактивные бронирования,`);
  console.log(`   без архивных. Поэтому в БД может быть больше записей, чем синхронизировано.`);

  await sql.end();
}

generateReport().catch(console.error);

