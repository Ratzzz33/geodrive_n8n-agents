#!/usr/bin/env node
/**
 * Миграция: Добавление UNIQUE constraint на (branch, payment_id)
 * для поддержки ON CONFLICT в workflow
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

console.log('🔧 Добавляю UNIQUE constraint на (branch, payment_id)...\n');

try {
  // Проверить существующие constraints
  console.log('1️⃣ Проверка существующих constraints...');
  const existingConstraints = await sql`
    SELECT constraint_name, constraint_type
    FROM information_schema.table_constraints
    WHERE table_name = 'payments'
      AND constraint_type = 'UNIQUE'
    ORDER BY constraint_name;
  `;
  
  console.log('\n📋 Существующие UNIQUE constraints:');
  existingConstraints.forEach(c => {
    console.log(`   - ${c.constraint_name}`);
  });
  
  // Добавить constraint на (branch, payment_id)
  console.log('\n2️⃣ Добавление constraint payments_branch_payment_id_alias_unique...');
  await sql.unsafe(`
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'payments_branch_payment_id_alias_unique'
      ) THEN
        ALTER TABLE payments 
        ADD CONSTRAINT payments_branch_payment_id_alias_unique 
        UNIQUE (branch, payment_id);
        
        RAISE NOTICE 'Constraint payments_branch_payment_id_alias_unique created';
      ELSE
        RAISE NOTICE 'Constraint payments_branch_payment_id_alias_unique already exists';
      END IF;
    END $$;
  `);
  console.log('   ✅ Constraint добавлен\n');

  // Проверить финальные constraints
  const finalConstraints = await sql`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'payments'
      AND constraint_type = 'UNIQUE'
      AND constraint_name LIKE '%payment_id%'
    ORDER BY constraint_name;
  `;
  
  console.log('📋 Финальные constraints на payment_id:');
  finalConstraints.forEach(c => {
    console.log(`   ✅ ${c.constraint_name}`);
  });

  console.log('\n✅ Миграция завершена успешно!\n');
  console.log('📊 Результат:');
  console.log('   ✅ UNIQUE (branch, payment_id) создан');
  console.log('   ✅ ON CONFLICT в workflow теперь работает');
  console.log('\n🚀 Workflow готов к повторному запуску!');
  
} catch (error) {
  console.error('\n❌ Ошибка миграции:', error.message);
  console.error('\nДетали:', error);
  process.exit(1);
} finally {
  await sql.end();
}

