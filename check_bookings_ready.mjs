#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

console.log('🔍 Проверка готовности bookings таблицы...\n');

try {
  // 1. Проверяем constraints
  const constraints = await sql`
    SELECT 
      conname as name,
      pg_get_constraintdef(oid) as definition
    FROM pg_constraint 
    WHERE conrelid = 'bookings'::regclass
      AND conname LIKE '%rentprog%' OR conname LIKE '%branch%number%'
    ORDER BY conname
  `;
  
  console.log('📋 Constraints:');
  if (constraints.length === 0) {
    console.log('  ⚠️  Нет constraints с rentprog или branch+number');
  } else {
    constraints.forEach(c => {
      console.log(`  ${c.name}: ${c.definition}`);
    });
  }
  console.log('');
  
  // 2. Проверяем колонки
  const columns = await sql`
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_name = 'bookings'
      AND column_name IN ('rentprog_id', 'branch_id', 'branch', 'number', 'location_start', 'location_end')
    ORDER BY column_name
  `;
  
  console.log('📋 Колонки:');
  columns.forEach(col => {
    const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
    console.log(`  ${col.column_name}: ${col.data_type} ${nullable}`);
  });
  console.log('');
  
  // 3. Статистика
  const stats = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(rentprog_id) as has_rentprog_id,
      COUNT(branch_id) as has_branch_id,
      COUNT(location_start) as has_location_start,
      COUNT(CASE WHEN rentprog_id IS NULL THEN 1 END) as null_rentprog_id
    FROM bookings
  `;
  
  console.log('📊 Статистика:');
  console.log(`  Всего броней: ${stats[0].total}`);
  console.log(`  С rentprog_id: ${stats[0].has_rentprog_id}`);
  console.log(`  С branch_id: ${stats[0].has_branch_id}`);
  console.log(`  С location_start: ${stats[0].has_location_start}`);
  console.log(`  Без rentprog_id: ${stats[0].null_rentprog_id}`);
  console.log('');
  
  // 4. Финальная оценка
  const hasUniqueRentprog = constraints.some(c => c.name === 'bookings_rentprog_id_unique');
  const hasNoBranchNumber = !constraints.some(c => c.name === 'bookings_branch_number_unique');
  const rentprogNotNull = columns.find(c => c.column_name === 'rentprog_id')?.is_nullable === 'NO';
  
  console.log('✅ ГОТОВНОСТЬ:');
  console.log(`  ${hasUniqueRentprog ? '✅' : '❌'} UNIQUE constraint на rentprog_id`);
  console.log(`  ${hasNoBranchNumber ? '✅' : '❌'} НЕТ неправильного constraint (branch+number)`);
  console.log(`  ${rentprogNotNull ? '✅' : '❌'} rentprog_id NOT NULL`);
  console.log('');
  
  if (hasUniqueRentprog && hasNoBranchNumber && rentprogNotNull) {
    console.log('🎉 БД ГОТОВА для тестирования workflow!');
  } else {
    console.log('⚠️  БД НЕ ГОТОВА! Нужно запустить миграцию.');
  }
  
} catch (err) {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
} finally {
  await sql.end();
}

