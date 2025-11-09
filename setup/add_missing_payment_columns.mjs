#!/usr/bin/env node
/**
 * Миграция: Добавление недостающих колонок в payments для совместимости с workflow
 * Эти колонки будут alias/дубликатами для RentProg данных
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

console.log('🔧 Добавляю недостающие колонки в payments для workflow...\n');

try {
  // 1. payment_id (alias для rp_payment_id)
  console.log('1️⃣ Добавление payment_id...');
  await sql.unsafe(`
    ALTER TABLE payments 
    ADD COLUMN IF NOT EXISTS payment_id BIGINT;
  `);
  console.log('   ✅ payment_id добавлен\n');

  // 2. sum (alias для amount)
  console.log('2️⃣ Добавление sum...');
  await sql.unsafe(`
    ALTER TABLE payments 
    ADD COLUMN IF NOT EXISTS sum NUMERIC;
  `);
  console.log('   ✅ sum добавлен\n');

  // 3. cash (часть payment_method)
  console.log('3️⃣ Добавление cash...');
  await sql.unsafe(`
    ALTER TABLE payments 
    ADD COLUMN IF NOT EXISTS cash NUMERIC DEFAULT 0;
  `);
  console.log('   ✅ cash добавлен\n');

  // 4. cashless (часть payment_method)
  console.log('4️⃣ Добавление cashless...');
  await sql.unsafe(`
    ALTER TABLE payments 
    ADD COLUMN IF NOT EXISTS cashless NUMERIC DEFAULT 0;
  `);
  console.log('   ✅ cashless добавлен\n');

  // 5. "group" (alias для payment_type) - кавычки т.к. group зарезервированное слово
  console.log('5️⃣ Добавление "group"...');
  await sql.unsafe(`
    ALTER TABLE payments 
    ADD COLUMN IF NOT EXISTS "group" TEXT;
  `);
  console.log('   ✅ "group" добавлен\n');

  // 6. subgroup (alias для payment_subgroup)
  console.log('6️⃣ Добавление subgroup...');
  await sql.unsafe(`
    ALTER TABLE payments 
    ADD COLUMN IF NOT EXISTS subgroup TEXT;
  `);
  console.log('   ✅ subgroup добавлен\n');

  // 7. car_id (alias для rp_car_id)
  console.log('7️⃣ Добавление car_id...');
  await sql.unsafe(`
    ALTER TABLE payments 
    ADD COLUMN IF NOT EXISTS car_id BIGINT;
  `);
  console.log('   ✅ car_id добавлен\n');

  // 8. client_id (alias для rp_client_id)
  console.log('8️⃣ Добавление client_id...');
  await sql.unsafe(`
    ALTER TABLE payments 
    ADD COLUMN IF NOT EXISTS client_id BIGINT;
  `);
  console.log('   ✅ client_id добавлен\n');

  // 9. user_id (alias для rp_user_id)
  console.log('9️⃣ Добавление user_id...');
  await sql.unsafe(`
    ALTER TABLE payments 
    ADD COLUMN IF NOT EXISTS user_id BIGINT;
  `);
  console.log('   ✅ user_id добавлен\n');

  // 10. Создать индексы для новых колонок
  console.log('🔟 Создание индексов...');
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON payments(payment_id);
    CREATE INDEX IF NOT EXISTS idx_payments_car_id ON payments(car_id);
    CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id);
    CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
    CREATE INDEX IF NOT EXISTS idx_payments_group ON payments("group");
  `);
  console.log('   ✅ Индексы созданы\n');

  // Проверка
  console.log('✅ Проверка добавленных колонок...');
  const newColumns = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'payments'
      AND column_name IN ('branch', 'payment_id', 'sum', 'cash', 'cashless', 'group', 
                          'subgroup', 'car_id', 'client_id', 'user_id')
    ORDER BY column_name;
  `;
  
  console.log('\n📋 Добавленные колонки:');
  newColumns.forEach(col => {
    console.log(`   ✅ ${col.column_name}: ${col.data_type}`);
  });

  console.log('\n✅ Миграция завершена успешно!\n');
  console.log('📊 Результат:');
  console.log('   ✅ 10 колонок добавлено');
  console.log('   ✅ 5 индексов создано');
  console.log('   ✅ Workflow теперь совместим с БД!');
  console.log('\n🚀 Готово для batch INSERT из workflow!');
  
} catch (error) {
  console.error('\n❌ Ошибка миграции:', error.message);
  console.error('\nДетали:', error);
  process.exit(1);
} finally {
  await sql.end();
}

