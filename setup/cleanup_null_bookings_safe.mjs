#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('='.repeat(80));
  console.log('БЕЗОПАСНАЯ ОЧИСТКА NULL ЗАПИСЕЙ ИЗ BOOKINGS');
  console.log('='.repeat(80));
  
  // Сначала посчитаем
  const countBefore = await sql`
    SELECT COUNT(*) as count
    FROM bookings
    WHERE branch IS NULL OR number IS NULL
  `;
  
  console.log(`\n📊 Найдено NULL записей: ${countBefore[0].count}`);
  
  if (parseInt(countBefore[0].count) === 0) {
    console.log('\n✅ Нет записей для удаления!');
    process.exit(0);
  }
  
  // Проверим есть ли связанные payments
  const relatedPayments = await sql`
    SELECT COUNT(*) as count
    FROM payments p
    WHERE p.booking_id IN (
      SELECT id FROM bookings 
      WHERE branch IS NULL OR number IS NULL
    )
  `;
  
  console.log(`\n🔗 Связанных payments: ${relatedPayments[0].count}`);
  
  // Удаляем сначала payments
  if (parseInt(relatedPayments[0].count) > 0) {
    console.log('\n⚠️  Удаляю связанные payments...');
    const deletedPayments = await sql`
      DELETE FROM payments
      WHERE booking_id IN (
        SELECT id FROM bookings 
        WHERE branch IS NULL OR number IS NULL
      )
    `;
    console.log(`✅ Удалено payments: ${deletedPayments.count}`);
  }
  
  // Теперь можно удалить bookings
  console.log('\n⚠️  Удаляю NULL bookings...');
  
  const result = await sql`
    DELETE FROM bookings
    WHERE branch IS NULL OR number IS NULL
  `;
  
  console.log(`\n✅ Удалено bookings: ${result.count}`);
  
  // Проверяем результат
  const countAfter = await sql`
    SELECT COUNT(*) as count
    FROM bookings
    WHERE branch IS NULL OR number IS NULL
  `;
  
  console.log(`\n🔍 Проверка: осталось NULL записей: ${countAfter[0].count}`);
  
  // Финальная статистика
  const stats = await sql`
    SELECT 
      branch,
      COUNT(*) as count,
      COUNT(DISTINCT number) as unique_bookings
    FROM bookings
    WHERE branch IS NOT NULL
    GROUP BY branch
    ORDER BY branch
  `;
  
  console.log('\n' + '='.repeat(80));
  console.log('ИТОГОВАЯ СТАТИСТИКА:');
  console.log('='.repeat(80));
  
  let total = 0;
  stats.forEach(row => {
    console.log(`\n  ${row.branch}:`);
    console.log(`    Всего: ${row.count}`);
    console.log(`    Уникальных: ${row.unique_bookings}`);
    total += parseInt(row.count);
  });
  
  console.log(`\n  ИТОГО: ${total} записей в БД`);
  console.log('\n✅ База данных очищена!');
  
} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

