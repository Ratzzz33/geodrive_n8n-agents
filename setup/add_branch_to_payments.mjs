#!/usr/bin/env node
/**
 * Миграция: Добавление колонки branch в таблицу payments
 * Для поддержки текстового кода филиала в payments
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

console.log('🔧 Добавляю колонку branch в таблицу payments...\n');

try {
  // 1. Добавить колонку branch
  console.log('1️⃣ Добавление колонки branch TEXT...');
  await sql.unsafe(`
    ALTER TABLE payments 
    ADD COLUMN IF NOT EXISTS branch TEXT;
  `);
  console.log('   ✅ Колонка branch добавлена\n');

  // 2. Создать индекс для производительности
  console.log('2️⃣ Создание индекса на branch...');
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_payments_branch 
    ON payments(branch);
  `);
  console.log('   ✅ Индекс создан\n');

  // 3. Создать составной индекс для быстрого поиска по branch + payment_id
  console.log('3️⃣ Создание составного индекса (branch, rp_payment_id)...');
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_payments_branch_rp_payment_id 
    ON payments(branch, rp_payment_id);
  `);
  console.log('   ✅ Составной индекс создан\n');

  // 4. Создать UNIQUE constraint для дедупликации (branch, payment_id)
  console.log('4️⃣ Создание UNIQUE constraint для дедупликации...');
  await sql.unsafe(`
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'payments_branch_payment_id_unique'
      ) THEN
        ALTER TABLE payments 
        ADD CONSTRAINT payments_branch_payment_id_unique 
        UNIQUE (branch, rp_payment_id);
      END IF;
    END $$;
  `);
  console.log('   ✅ UNIQUE constraint создан\n');

  // 5. Проверка структуры
  console.log('5️⃣ Проверка структуры таблицы payments...');
  const columns = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'payments'
      AND column_name IN ('branch', 'branch_id', 'rp_payment_id')
    ORDER BY column_name;
  `;
  
  console.log('\n📋 Структура таблицы payments (релевантные колонки):');
  columns.forEach(col => {
    console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
  });

  // 6. Проверка индексов
  console.log('\n6️⃣ Проверка индексов...');
  const indexes = await sql`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'payments'
      AND indexname LIKE '%branch%'
    ORDER BY indexname;
  `;
  
  console.log('\n📋 Индексы на branch:');
  indexes.forEach(idx => {
    console.log(`   - ${idx.indexname}`);
  });

  console.log('\n✅ Миграция завершена успешно!\n');
  console.log('📊 Результат:');
  console.log('   ✅ Колонка branch добавлена');
  console.log('   ✅ Индексы созданы для производительности');
  console.log('   ✅ UNIQUE constraint для дедупликации');
  console.log('\n🚀 Теперь workflow может сохранять payments с branch!');
  
} catch (error) {
  console.error('\n❌ Ошибка миграции:', error.message);
  console.error('\nДетали:', error);
  process.exit(1);
} finally {
  await sql.end();
}

