#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('='.repeat(80));
  console.log('ПРОВЕРКА ТЕХНИЧЕСКИХ БРОНЕЙ В БД');
  console.log('='.repeat(80));
  
  // Общая статистика
  const totalStats = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN is_technical = true THEN 1 END) as technical,
      COUNT(CASE WHEN is_technical = false THEN 1 END) as regular
    FROM bookings
    WHERE branch IS NOT NULL
  `;
  
  console.log('\n📊 ОБЩАЯ СТАТИСТИКА:');
  console.log(`   Всего броней: ${totalStats[0].total}`);
  console.log(`   Технических: ${totalStats[0].technical} (${Math.round((totalStats[0].technical / totalStats[0].total) * 100)}%)`);
  console.log(`   Обычных: ${totalStats[0].regular} (${Math.round((totalStats[0].regular / totalStats[0].total) * 100)}%)`);
  
  // По филиалам
  console.log('\n' + '='.repeat(80));
  console.log('ПО ФИЛИАЛАМ:');
  console.log('='.repeat(80));
  
  const branchStats = await sql`
    SELECT 
      branch,
      COUNT(*) as total,
      COUNT(CASE WHEN is_technical = true THEN 1 END) as technical,
      COUNT(CASE WHEN is_technical = false THEN 1 END) as regular
    FROM bookings
    WHERE branch IS NOT NULL
    GROUP BY branch
    ORDER BY branch
  `;
  
  branchStats.forEach(row => {
    const techPercent = row.total > 0 ? Math.round((row.technical / row.total) * 100) : 0;
    console.log(`\n  ${row.branch}:`);
    console.log(`    Всего: ${row.total}`);
    console.log(`    Технических: ${row.technical} (${techPercent}%)`);
    console.log(`    Обычных: ${row.regular}`);
  });
  
  // По типам технических броней
  console.log('\n' + '='.repeat(80));
  console.log('ПО ТИПАМ ТЕХНИЧЕСКИХ БРОНЕЙ:');
  console.log('='.repeat(80));
  
  const typeStats = await sql`
    SELECT 
      technical_type,
      COUNT(*) as count,
      COUNT(CASE WHEN is_active THEN 1 END) as active,
      COUNT(CASE WHEN NOT is_active THEN 1 END) as inactive
    FROM bookings
    WHERE is_technical = true AND branch IS NOT NULL
    GROUP BY technical_type
    ORDER BY count DESC
  `;
  
  if (typeStats.length > 0) {
    typeStats.forEach(row => {
      console.log(`\n  ${row.technical_type || 'NULL'}:`);
      console.log(`    Всего: ${row.count}`);
      console.log(`    Активных: ${row.active}`);
      console.log(`    Неактивных: ${row.inactive}`);
    });
  } else {
    console.log('\n  ⚠️  Технических броней не найдено!');
  }
  
  // Примеры технических броней
  console.log('\n' + '='.repeat(80));
  console.log('ПРИМЕРЫ ТЕХНИЧЕСКИХ БРОНЕЙ (последние 10):');
  console.log('='.repeat(80));
  
  const examples = await sql`
    SELECT 
      branch,
      number,
      client_name,
      car_name,
      technical_type,
      technical_purpose,
      start_date,
      end_date,
      is_active
    FROM bookings
    WHERE is_technical = true AND branch IS NOT NULL
    ORDER BY updated_at DESC
    LIMIT 10
  `;
  
  if (examples.length > 0) {
    examples.forEach((row, index) => {
      console.log(`\n  ${index + 1}. [${row.branch}] #${row.number}`);
      console.log(`     Клиент: ${row.client_name || 'N/A'}`);
      console.log(`     Авто: ${row.car_name || 'N/A'}`);
      console.log(`     Тип: ${row.technical_type || 'N/A'}`);
      console.log(`     Назначение: ${row.technical_purpose || 'N/A'}`);
      console.log(`     Даты: ${row.start_date} → ${row.end_date}`);
      console.log(`     Статус: ${row.is_active ? '✅ Активна' : '❌ Неактивна'}`);
    });
  } else {
    console.log('\n  ⚠️  Технических броней не найдено!');
  }
  
  // Проверка полей
  console.log('\n' + '='.repeat(80));
  console.log('ПРОВЕРКА ПОЛЕЙ:');
  console.log('='.repeat(80));
  
  const fieldCheck = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(is_technical) as has_is_technical,
      COUNT(technical_type) as has_technical_type,
      COUNT(technical_purpose) as has_technical_purpose
    FROM bookings
    WHERE branch IS NOT NULL
  `;
  
  console.log(`\n  Всего записей: ${fieldCheck[0].total}`);
  console.log(`  Имеют is_technical: ${fieldCheck[0].has_is_technical}`);
  console.log(`  Имеют technical_type: ${fieldCheck[0].has_technical_type}`);
  console.log(`  Имеют technical_purpose: ${fieldCheck[0].has_technical_purpose}`);
  
  // Итоговый вывод
  console.log('\n' + '='.repeat(80));
  console.log('ВЫВОД:');
  console.log('='.repeat(80));
  
  if (parseInt(totalStats[0].technical) > 0) {
    console.log('\n✅ ТЕХНИЧЕСКИЕ БРОНИ ПРИСУТСТВУЮТ В БД!');
    console.log(`   Найдено: ${totalStats[0].technical} технических броней`);
    console.log(`   Процент: ${Math.round((totalStats[0].technical / totalStats[0].total) * 100)}%`);
  } else {
    console.log('\n❌ ТЕХНИЧЕСКИХ БРОНЕЙ НЕТ В БД!');
    console.log('   Возможные причины:');
    console.log('   1. Поля is_technical не заполнены');
    console.log('   2. Логика определения технических броней не работает');
    console.log('   3. В RentProg нет технических броней за последние 30 дней');
  }
  
} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

