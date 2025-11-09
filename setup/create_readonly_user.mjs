/**
 * Создание read-only пользователя для стороннего бота
 * Пользователь будет иметь доступ только на SELECT
 */

import postgres from 'postgres';
import crypto from 'crypto';

const ADMIN_CONNECTION = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

// Генерируем безопасный пароль (32 символа)
const generatePassword = () => {
  return crypto.randomBytes(24).toString('base64').replace(/[+/=]/g, 'x');
};

const USERNAME = 'bot_readonly';
const PASSWORD = generatePassword();

const sql = postgres(ADMIN_CONNECTION, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

console.log('🔐 Создание read-only пользователя...\n');

try {
  // 1. Проверяем, существует ли пользователь
  const existingUser = await sql`
    SELECT 1 FROM pg_roles WHERE rolname = ${USERNAME}
  `;

  if (existingUser.length > 0) {
    console.log('⚠️  Пользователь уже существует. Удаляем...');
    await sql.unsafe(`DROP USER ${USERNAME}`);
    console.log('✅ Старый пользователь удален\n');
  }

  // 2. Создаем пользователя
  console.log('📝 Создаю пользователя...');
  await sql.unsafe(`CREATE USER ${USERNAME} WITH PASSWORD '${PASSWORD}'`);
  console.log('✅ Пользователь создан');

  // 3. Даем доступ к БД
  console.log('📝 Даю доступ к БД...');
  await sql.unsafe(`GRANT CONNECT ON DATABASE neondb TO ${USERNAME}`);
  console.log('✅ Доступ к БД разрешен');

  // 4. Даем доступ к схеме public
  console.log('📝 Даю доступ к схеме public...');
  await sql.unsafe(`GRANT USAGE ON SCHEMA public TO ${USERNAME}`);
  console.log('✅ Доступ к схеме разрешен');

  // 5. Даем SELECT на все существующие таблицы
  console.log('📝 Даю SELECT на все таблицы...');
  await sql.unsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${USERNAME}`);
  console.log('✅ SELECT права установлены');

  // 6. Даем SELECT на все будущие таблицы
  console.log('📝 Устанавливаю права на будущие таблицы...');
  await sql.unsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${USERNAME}`);
  console.log('✅ Права на будущие таблицы установлены');

  // 7. Проверяем права
  console.log('\n🔍 Проверка прав...');
  const grants = await sql`
    SELECT table_name, privilege_type
    FROM information_schema.role_table_grants
    WHERE grantee = ${USERNAME}
    ORDER BY table_name
    LIMIT 10
  `;

  console.log(`✅ Права установлены на ${grants.length}+ таблиц\n`);

  // Выводим результат
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 READ-ONLY ПОЛЬЗОВАТЕЛЬ УСПЕШНО СОЗДАН!\n');
  console.log('📋 Данные для подключения:\n');
  console.log(`Username: ${USERNAME}`);
  console.log(`Password: ${PASSWORD}\n`);
  console.log('🔗 Connection String:\n');
  console.log(`postgresql://${USERNAME}:${PASSWORD}@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n⚠️  ВАЖНО: Сохраните эти данные! Пароль не будет показан снова.\n');

  console.log('✅ Разрешенные операции: SELECT (чтение)');
  console.log('❌ Запрещены: INSERT, UPDATE, DELETE, TRUNCATE, DROP, CREATE, ALTER\n');

} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

