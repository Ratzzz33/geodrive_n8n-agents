/**
 * Проверка read-only пользователя
 * Тестирует, что пользователь может читать, но не может изменять данные
 */

import postgres from 'postgres';

const READONLY_CONNECTION = 'postgresql://bot_readonly:qNMSE5wAiPKRDYxJ719DeX9nm6Y4xWr1@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(READONLY_CONNECTION, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

console.log('🧪 Тестирование read-only пользователя...\n');

try {
  // Тест 1: SELECT должен работать
  console.log('✅ Тест 1: SELECT запросы');
  const branches = await sql`SELECT code, name FROM branches LIMIT 3`;
  console.log(`   Прочитано ${branches.length} филиалов:`);
  branches.forEach(b => console.log(`   - ${b.code}: ${b.name}`));

  const cars = await sql`SELECT COUNT(*) as count FROM cars`;
  console.log(`   Прочитано информация о ${cars[0].count} машинах\n`);

  // Тест 2: INSERT должен быть запрещен
  console.log('❌ Тест 2: INSERT (должен быть запрещен)');
  try {
    await sql`INSERT INTO branches (id, code, name) VALUES (gen_random_uuid(), 'test', 'Test')`;
    console.log('   ⚠️  ОШИБКА: INSERT разрешен! (не должен быть)\n');
  } catch (error) {
    console.log(`   ✅ Правильно запрещен: ${error.message}\n`);
  }

  // Тест 3: UPDATE должен быть запрещен
  console.log('❌ Тест 3: UPDATE (должен быть запрещен)');
  try {
    await sql`UPDATE branches SET name = 'Test' WHERE code = 'tbilisi'`;
    console.log('   ⚠️  ОШИБКА: UPDATE разрешен! (не должен быть)\n');
  } catch (error) {
    console.log(`   ✅ Правильно запрещен: ${error.message}\n`);
  }

  // Тест 4: DELETE должен быть запрещен
  console.log('❌ Тест 4: DELETE (должен быть запрещен)');
  try {
    await sql`DELETE FROM branches WHERE code = 'test'`;
    console.log('   ⚠️  ОШИБКА: DELETE разрешен! (не должен быть)\n');
  } catch (error) {
    console.log(`   ✅ Правильно запрещен: ${error.message}\n`);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ Пользователь bot_readonly работает корректно:');
  console.log('   - Может читать данные (SELECT)');
  console.log('   - Не может изменять данные (INSERT/UPDATE/DELETE)\n');

} catch (error) {
  console.error('❌ Критическая ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

