#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('='.repeat(80));
  console.log('ПРОВЕРКА СОХРАНЁННЫХ БРОНЕЙ В БД');
  console.log('='.repeat(80));
  
  // Общая статистика
  const total = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(DISTINCT number) as unique_numbers,
      COUNT(DISTINCT branch) as branches
    FROM bookings
  `;
  
  console.log('\n📊 Общая статистика:');
  console.log(`  Всего записей: ${total[0].total}`);
  console.log(`  Уникальных номеров броней: ${total[0].unique_numbers}`);
  console.log(`  Филиалов: ${total[0].branches}`);
  
  // По филиалам
  const byBranch = await sql`
    SELECT 
      branch,
      COUNT(*) as total,
      COUNT(DISTINCT number) as unique_bookings,
      COUNT(CASE WHEN is_active THEN 1 END) as active,
      COUNT(CASE WHEN NOT is_active THEN 1 END) as inactive,
      COUNT(CASE WHEN is_technical THEN 1 END) as technical
    FROM bookings
    GROUP BY branch
    ORDER BY branch
  `;
  
  console.log('\n📍 По филиалам:');
  byBranch.forEach(b => {
    console.log(`\n  ${b.branch || 'NULL'}:`);
    console.log(`    Всего: ${b.total}`);
    console.log(`    Уникальных: ${b.unique_bookings}`);
    console.log(`    Активных: ${b.active}`);
    console.log(`    Неактивных: ${b.inactive}`);
    console.log(`    Технических: ${b.technical}`);
  });
  
  // Последние добавленные
  const recent = await sql`
    SELECT 
      branch,
      number,
      client_name,
      car_name,
      source,
      is_technical,
      created_at,
      updated_at
    FROM bookings
    ORDER BY updated_at DESC
    LIMIT 10
  `;
  
  console.log('\n⏰ Последние 10 обновлённых:');
  recent.forEach((r, i) => {
    console.log(`\n  ${i+1}. ${r.branch} #${r.number}`);
    console.log(`     Клиент: ${r.client_name || 'N/A'}`);
    console.log(`     Авто: ${r.car_name || 'N/A'}`);
    console.log(`     Источник: ${r.source || 'N/A'}`);
    console.log(`     Техническая: ${r.is_technical ? 'Да' : 'Нет'}`);
    console.log(`     Обновлено: ${r.updated_at}`);
  });
  
  // Проверка данных с последнего execution (по времени)
  const recentHour = await sql`
    SELECT COUNT(*) as count
    FROM bookings
    WHERE updated_at > NOW() - INTERVAL '1 hour'
  `;
  
  console.log('\n\n⏱️  Обновлено за последний час: ' + recentHour[0].count);
  
  const recentDay = await sql`
    SELECT COUNT(*) as count
    FROM bookings
    WHERE updated_at > NOW() - INTERVAL '1 day'
  `;
  
  console.log('⏱️  Обновлено за последний день: ' + recentDay[0].count);
  
  // Проверка на дубликаты
  const duplicates = await sql`
    SELECT branch, number, COUNT(*) as dup_count
    FROM bookings
    GROUP BY branch, number
    HAVING COUNT(*) > 1
    LIMIT 10
  `;
  
  if (duplicates.length > 0) {
    console.log('\n\n⚠️  ДУБЛИКАТЫ (первые 10):');
    duplicates.forEach(d => {
      console.log(`  ${d.branch} #${d.number}: ${d.dup_count} раз`);
    });
  } else {
    console.log('\n\n✅ Дубликатов нет (UNIQUE constraint работает)');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('ИТОГ:');
  console.log('='.repeat(80));
  
  const expected = 15824; // Из последнего execution
  const actual = parseInt(total[0].total);
  const percentage = Math.round((actual / expected) * 100);
  
  console.log(`\nОжидалось из workflow: ${expected}`);
  console.log(`Реально в БД: ${actual}`);
  console.log(`Сохранилось: ${percentage}%`);
  
  if (percentage >= 95) {
    console.log('\n✅ ОТЛИЧНО! Почти все данные сохранились.');
    console.log('   Можно уменьшать объём загрузки.');
  } else if (percentage >= 70) {
    console.log('\n⚠️  Сохранилась большая часть, но есть потери.');
  } else {
    console.log('\n❌ Сохранилось мало данных, нужно разбираться.');
  }
  
} finally {
  await sql.end();
}

