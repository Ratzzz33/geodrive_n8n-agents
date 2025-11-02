#!/usr/bin/env node
/**
 * Тестирование подключения к PostgreSQL базе данных
 * Используется в GitHub Actions workflow: check-db-connection.yml
 */

const postgres = require('postgres');

const url = process.env.DATABASE_URL || '';

console.log('🔍 Проверяю DATABASE_URL...');
console.log('Длина DATABASE_URL:', url.length);
console.log('Начинается с:', url.substring(0, 20));

if (!url) {
  console.error('❌ DATABASE_URL пустой');
  process.exit(1);
}

// Маскируем пароль для вывода
const masked = url.replace(/:[^:@]+@/, ':***@');
console.log('DATABASE_URL (замаскирован):', masked);

// Проверяем наличие sslmode в URL
const hasSslMode = url.includes('sslmode=');
console.log('sslmode в URL:', hasSslMode ? 'есть' : 'нет');

// Настройка подключения
const options = {
  max: 1,
};

if (!hasSslMode) {
  options.ssl = { rejectUnauthorized: false };
  console.log('Добавляю SSL опцию: { rejectUnauthorized: false }');
}

console.log('');
console.log('🔍 Пробую подключиться к БД...');

// Тестирование подключения
(async () => {
  let sql;
  try {
    sql = postgres(url, options);
    
    // Простой тестовый запрос
    const result = await sql`SELECT 1 as test, current_timestamp as now`;
    
    console.log('✅ Подключение к БД успешно!');
    console.log('Результат теста:', result[0]);
    console.log('');
    console.log('🔍 Проверяю структуру БД...');
    
    // Проверка таблиц
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    console.log(`Найдено таблиц: ${tables.length}`);
    if (tables.length > 0) {
      console.log('Таблицы:', tables.map(t => t.table_name).join(', '));
    }
    
    await sql.end();
    console.log('');
    console.log('✅ Проверка БД завершена успешно');
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ Ошибка подключения к БД:');
    console.error('Сообщение:', error.message);
    
    if (error.stack) {
      console.error('');
      console.error('Stack trace:');
      console.error(error.stack);
    }
    
    if (error.cause) {
      console.error('');
      console.error('Причина:');
      console.error(error.cause);
    }
    
    if (sql) {
      try {
        await sql.end();
      } catch (e) {
        // Игнорируем ошибки при закрытии
      }
    }
    
    process.exit(1);
  }
})();

