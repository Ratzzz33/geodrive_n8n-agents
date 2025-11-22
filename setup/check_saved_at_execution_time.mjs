#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('='.repeat(80));
  console.log('ПРОВЕРКА СОХРАНЁННЫХ ДАННЫХ ВО ВРЕМЯ EXECUTION #11286');
  console.log('='.repeat(80));
  
  // Execution был: 2025-11-13T13:52:53.756Z → 2025-11-13T13:52:53.946Z
  // Проверим что обновлялось в это время (±5 минут для запаса)
  
  const executionTime = '2025-11-13 13:52:53';
  
  console.log(`\nВремя execution: ${executionTime}`);
  console.log('Ищем обновления в БД в промежутке ±5 минут...\n');
  
  // Записи обновлённые во время этого execution
  const updatedDuringExecution = await sql`
    SELECT 
      branch,
      COUNT(*) as count,
      MIN(updated_at) as first_update,
      MAX(updated_at) as last_update
    FROM bookings
    WHERE updated_at BETWEEN 
      (TIMESTAMP '${sql.unsafe(executionTime)}' - INTERVAL '5 minutes') AND
      (TIMESTAMP '${sql.unsafe(executionTime)}' + INTERVAL '5 minutes')
    GROUP BY branch
    ORDER BY branch
  `;
  
  if (updatedDuringExecution.length > 0) {
    console.log('📊 Обновления во время execution:');
    let total = 0;
    updatedDuringExecution.forEach(row => {
      console.log(`\n  ${row.branch || 'NULL'}:`);
      console.log(`    Записей: ${row.count}`);
      console.log(`    Первое: ${row.first_update}`);
      console.log(`    Последнее: ${row.last_update}`);
      total += parseInt(row.count);
    });
    console.log(`\n  ВСЕГО обновлено: ${total}`);
  } else {
    console.log('❌ Не найдено обновлений в это время');
  }
  
  // Проверим за весь день 13 ноября
  console.log('\n' + '='.repeat(80));
  console.log('ОБНОВЛЕНИЯ ЗА ВЕСЬ ДЕНЬ 13.11.2025:');
  console.log('='.repeat(80));
  
  const updatedToday = await sql`
    SELECT 
      branch,
      COUNT(*) as count
    FROM bookings
    WHERE DATE(updated_at) = '2025-11-13'
    GROUP BY branch
    ORDER BY branch
  `;
  
  if (updatedToday.length > 0) {
    console.log('\n📅 Обновления за день:');
    let totalDay = 0;
    updatedToday.forEach(row => {
      console.log(`  ${row.branch || 'NULL'}: ${row.count}`);
      totalDay += parseInt(row.count);
    });
    console.log(`\n  ИТОГО за день: ${totalDay}`);
  }
  
  // Статистика по филиалам (актуальная)
  console.log('\n' + '='.repeat(80));
  console.log('ТЕКУЩЕЕ СОСТОЯНИЕ БД:');
  console.log('='.repeat(80));
  
  const current = await sql`
    SELECT 
      branch,
      COUNT(*) as total,
      COUNT(DISTINCT number) as unique_bookings,
      COUNT(CASE WHEN is_active THEN 1 END) as active,
      COUNT(CASE WHEN NOT is_active THEN 1 END) as inactive
    FROM bookings
    WHERE branch IS NOT NULL
    GROUP BY branch
    ORDER BY branch
  `;
  
  console.log('\n📍 По филиалам (только с branch):');
  let grandTotal = 0;
  let grandUnique = 0;
  current.forEach(row => {
    console.log(`\n  ${row.branch}:`);
    console.log(`    Всего: ${row.total}`);
    console.log(`    Уникальных: ${row.unique_bookings}`);
    console.log(`    Активных: ${row.active}`);
    console.log(`    Неактивных: ${row.inactive}`);
    grandTotal += parseInt(row.total);
    grandUnique += parseInt(row.unique_bookings);
  });
  
  console.log(`\n  ИТОГО:`);
  console.log(`    Всего записей: ${grandTotal}`);
  console.log(`    Уникальных броней: ${grandUnique}`);
  
  // NULL записи
  const nullRecords = await sql`
    SELECT COUNT(*) as count
    FROM bookings
    WHERE branch IS NULL OR number IS NULL
  `;
  
  console.log(`\n  ⚠️  Записей с NULL (branch или number): ${nullRecords[0].count}`);
  
  // Итоговый вывод
  console.log('\n' + '='.repeat(80));
  console.log('ВЫВОД:');
  console.log('='.repeat(80));
  
  const expectedFromWorkflow = 15824; // Из Process All Bookings
  
  console.log(`\nОжидалось из workflow: ${expectedFromWorkflow}`);
  console.log(`Уникальных в БД: ${grandUnique}`);
  console.log(`Процент: ${Math.round((grandUnique / expectedFromWorkflow) * 100)}%`);
  
  if (grandUnique >= expectedFromWorkflow * 0.9) {
    console.log('\n✅ ОТЛИЧНО! Почти все данные сохранились.');
    console.log('   Можно переходить к фильтру по датам (последние 30 дней).');
  } else if (grandUnique >= expectedFromWorkflow * 0.5) {
    console.log('\n⚠️  Сохранилось примерно половина.');
    console.log('   Возможно, workflow запускался несколько раз и часть данных уже была.');
  } else {
    console.log('\n❌ Сохранилось мало. Нужно доработать workflow.');
  }
  
  // Рекомендация
  if (grandUnique >= 1000) {
    console.log('\n💡 РЕКОМЕНДАЦИЯ:');
    console.log('   У вас уже есть ' + grandUnique + ' уникальных броней в БД.');
    console.log('   Это хороший результат для начала работы!');
    console.log('   ');
    console.log('   Дальше можно:');
    console.log('   1. Включить фильтр по датам (последние 30 дней)');
    console.log('   2. Активировать workflow для регулярных обновлений каждые 15 минут');
    console.log('   3. Удалить NULL записи: DELETE FROM bookings WHERE branch IS NULL');
  }
  
} finally {
  await sql.end();
}

