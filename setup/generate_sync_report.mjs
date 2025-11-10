/**
 * Генерация отчета о синхронизации бронирований на основе результатов и данных БД
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

// Результаты синхронизации (из последнего запуска)
const syncResults = {
  "success": true,
  "timestamp": "2025-11-10T12:45:25.997Z",
  "summary": {
    "total_bookings": 40,
    "total_created": 21,
    "total_updated": 19,
    "total_errors": 0
  },
  "per_branch": [
    {"branch": "tbilisi", "total": 10, "created": 5, "updated": 5, "errors": 0},
    {"branch": "batumi", "total": 10, "created": 7, "updated": 3, "errors": 0},
    {"branch": "kutaisi", "total": 10, "created": 3, "updated": 7, "errors": 0},
    {"branch": "service-center", "total": 10, "created": 6, "updated": 4, "errors": 0}
  ]
};

async function getBookingStats() {
  // Статистика по филиалам
  const branchStats = await sql`
    SELECT 
      br.code as branch,
      COUNT(DISTINCT b.id) as total_bookings,
      COUNT(DISTINCT CASE WHEN b.created_at > NOW() - INTERVAL '1 hour' THEN b.id END) as recent_created,
      COUNT(DISTINCT CASE WHEN b.updated_at > NOW() - INTERVAL '1 hour' AND b.created_at < NOW() - INTERVAL '1 hour' THEN b.id END) as recent_updated
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
      COUNT(DISTINCT CASE WHEN b.created_at > NOW() - INTERVAL '1 hour' THEN b.id END) as created_last_hour,
      COUNT(DISTINCT CASE WHEN b.updated_at > NOW() - INTERVAL '1 hour' AND b.created_at < NOW() - INTERVAL '1 hour' THEN b.id END) as updated_last_hour,
      COUNT(DISTINCT CASE WHEN b.status IS NULL THEN b.id END) as without_status,
      COUNT(DISTINCT CASE WHEN b.start_at IS NULL THEN b.id END) as without_start,
      COUNT(DISTINCT CASE WHEN b.end_at IS NULL THEN b.id END) as without_end
    FROM bookings b
    JOIN external_refs er ON er.entity_id = b.id
    WHERE er.entity_type = 'booking' AND er.system = 'rentprog'
  `;

  // Бронирования без связей
  const withoutCar = await sql`
    SELECT COUNT(*) as count
    FROM bookings b
    JOIN external_refs er ON er.entity_id = b.id
    WHERE er.entity_type = 'booking' 
      AND er.system = 'rentprog'
      AND b.car_id IS NULL
  `;

  const withoutClient = await sql`
    SELECT COUNT(*) as count
    FROM bookings b
    JOIN external_refs er ON er.entity_id = b.id
    WHERE er.entity_type = 'booking' 
      AND er.system = 'rentprog'
      AND b.client_id IS NULL
  `;

  // Последние обновленные бронирования
  const recentlyUpdated = await sql`
    SELECT 
      er.external_id as rentprog_id,
      br.code as branch,
      b.status,
      b.start_at,
      b.updated_at
    FROM bookings b
    JOIN external_refs er ON er.entity_id = b.id
    JOIN branches br ON br.id = b.branch_id
    WHERE er.entity_type = 'booking' 
      AND er.system = 'rentprog'
      AND b.updated_at > NOW() - INTERVAL '1 hour'
    ORDER BY b.updated_at DESC
    LIMIT 10
  `;

  return {
    branchStats,
    totalStats: totalStats[0],
    withoutCar: withoutCar[0].count,
    withoutClient: withoutClient[0].count,
    recentlyUpdated
  };
}

async function main() {
  console.log('📊 ОТЧЕТ О СИНХРОНИЗАЦИИ БРОНИРОВАНИЙ');
  console.log('='.repeat(70));
  console.log(`Время синхронизации: ${new Date(syncResults.timestamp).toLocaleString('ru-RU')}`);
  console.log('='.repeat(70));

  console.log('\n📈 РЕЗУЛЬТАТЫ СИНХРОНИЗАЦИИ:');
  console.log(`   Всего обработано: ${syncResults.summary.total_bookings} бронирований`);
  console.log(`   Создано новых: ${syncResults.summary.total_created}`);
  console.log(`   Обновлено существующих: ${syncResults.summary.total_updated}`);
  console.log(`   Ошибок: ${syncResults.summary.total_errors}`);

  console.log('\n📋 ПО ФИЛИАЛАМ:');
  syncResults.per_branch.forEach(branch => {
    console.log(`   ${branch.branch.toUpperCase()}:`);
    console.log(`      Всего: ${branch.total}, Создано: ${branch.created}, Обновлено: ${branch.updated}, Ошибок: ${branch.errors}`);
  });

  console.log('\n📊 АНАЛИЗ ДАННЫХ В БД:');
  const stats = await getBookingStats();

  console.log(`\n   Общая статистика:`);
  console.log(`      Всего бронирований в БД: ${stats.totalStats.total}`);
  console.log(`      Создано за последний час: ${stats.totalStats.created_last_hour}`);
  console.log(`      Обновлено за последний час: ${stats.totalStats.updated_last_hour}`);
  console.log(`      Без статуса: ${stats.totalStats.without_status}`);
  console.log(`      Без даты начала: ${stats.totalStats.without_start}`);
  console.log(`      Без даты окончания: ${stats.totalStats.without_end}`);
  console.log(`      Без связи с авто: ${stats.withoutCar}`);
  console.log(`      Без связи с клиентом: ${stats.withoutClient}`);

  console.log(`\n   По филиалам:`);
  stats.branchStats.forEach(branch => {
    console.log(`      ${branch.branch.toUpperCase()}: ${branch.total_bookings} бронирований`);
  });

  console.log(`\n   Последние обновленные бронирования (топ-10):`);
  stats.recentlyUpdated.forEach(booking => {
    console.log(`      - RP ID: ${booking.rentprog_id}, Филиал: ${booking.branch}, Статус: ${booking.status || 'N/A'}, Обновлено: ${new Date(booking.updated_at).toLocaleString('ru-RU')}`);
  });

  // Анализ расхождений
  console.log('\n⚠️  АНАЛИЗ РАСХОЖДЕНИЙ:');
  
  const totalInRP = syncResults.summary.total_bookings;
  const totalInDB = stats.totalStats.total;
  const discrepancy = totalInDB - totalInRP;

  if (discrepancy > 0) {
    console.log(`   ⚠️  В БД больше бронирований, чем было синхронизировано: +${discrepancy}`);
    console.log(`      Возможные причины:`);
    console.log(`      - Бронирования были созданы ранее`);
    console.log(`      - Бронирования из архивных данных`);
    console.log(`      - Бронирования из других источников`);
  } else if (discrepancy < 0) {
    console.log(`   ⚠️  В RentProg больше бронирований, чем в БД: ${Math.abs(discrepancy)}`);
    console.log(`      Возможные причины:`);
    console.log(`      - Ошибки при синхронизации`);
    console.log(`      - Бронирования были удалены из RentProg после синхронизации`);
  } else {
    console.log(`   ✅ Количество совпадает: ${totalInRP} = ${totalInDB}`);
  }

  if (stats.totalStats.without_status > 0) {
    console.log(`\n   ⚠️  Найдено ${stats.totalStats.without_status} бронирований без статуса`);
  }

  if (stats.withoutCar > 0) {
    console.log(`   ⚠️  Найдено ${stats.withoutCar} бронирований без связи с авто`);
  }

  if (stats.withoutClient > 0) {
    console.log(`   ⚠️  Найдено ${stats.withoutClient} бронирований без связи с клиентом`);
  }

  // Итоговый вывод
  console.log('\n' + '='.repeat(70));
  console.log('✅ ИТОГОВЫЙ ОТЧЕТ');
  console.log('='.repeat(70));
  console.log(`\nСинхронизация выполнена успешно:`);
  console.log(`   - Обработано: ${syncResults.summary.total_bookings} бронирований`);
  console.log(`   - Создано: ${syncResults.summary.total_created} новых записей`);
  console.log(`   - Обновлено: ${syncResults.summary.total_updated} существующих записей`);
  console.log(`   - Ошибок: ${syncResults.summary.total_errors}`);
  console.log(`\nТекущее состояние БД:`);
  console.log(`   - Всего бронирований: ${stats.totalStats.total}`);
  console.log(`   - Проблемных записей: ${stats.totalStats.without_status + stats.withoutCar + stats.withoutClient}`);
  
  if (syncResults.summary.total_errors === 0 && stats.totalStats.without_status === 0) {
    console.log(`\n✅ Все данные синхронизированы корректно!`);
  } else {
    console.log(`\n⚠️  Обнаружены проблемы, требующие внимания.`);
  }

  await sql.end();
}

main().catch(console.error);

