#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

/**
 * Миграция: Исправление архитектуры bookings
 * 
 * Проблема:
 * - bookings_branch_number_unique - неправильный constraint (branch+number не уникальны глобально)
 * - Брони СКВОЗНЫЕ для компании (как платежи, сотрудники)
 * - rentprog_id - ЕДИНСТВЕННЫЙ правильный глобальный идентификатор
 * 
 * Решение:
 * 1. Удалить bookings_branch_number_unique
 * 2. Создать UNIQUE на rentprog_id
 * 3. Убедиться что branch_id существует (fallback для определения филиала)
 * 4. Убедиться что branch и number NOT NULL (для валидации данных)
 */

async function fixBookingsArchitecture() {
  console.log('🔧 Исправление архитектуры bookings...\n');
  console.log('=' .repeat(60));
  console.log('');
  
  // 1. Удаляем неправильный constraint
  console.log('📋 Step 1: Удаление неправильного constraint...\n');
  
  await sql`
    ALTER TABLE bookings 
    DROP CONSTRAINT IF EXISTS bookings_branch_number_unique
  `;
  console.log('  ✅ bookings_branch_number_unique удален\n');
  
  // 2. Проверяем наличие branch_id
  console.log('📋 Step 2: Проверка branch_id...\n');
  
  const hasBranchId = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'bookings' 
      AND column_name = 'branch_id'
  `;
  
  if (hasBranchId.length === 0) {
    console.log('  ℹ️  Колонка branch_id отсутствует, создаем...');
    await sql`
      ALTER TABLE bookings 
      ADD COLUMN branch_id UUID REFERENCES branches(id)
    `;
    console.log('  ✅ branch_id создана');
    
    // Создаем индекс
    await sql`
      CREATE INDEX IF NOT EXISTS idx_bookings_branch_id 
      ON bookings(branch_id)
    `;
    console.log('  ✅ Индекс idx_bookings_branch_id создан');
  } else {
    console.log('  ✅ branch_id уже существует');
  }
  console.log('');
  
  // 3. Проверяем и заполняем rentprog_id
  console.log('📋 Step 3: Проверка и заполнение rentprog_id...\n');
  
  const nullRentprogIds = await sql`
    SELECT COUNT(*) as count
    FROM bookings
    WHERE rentprog_id IS NULL
  `;
  
  if (nullRentprogIds[0].count > 0) {
    console.log(`  ⚠️  Найдено ${nullRentprogIds[0].count} записей без rentprog_id`);
    console.log('  Заполняем из data->>"id"...');
    
    const updated = await sql`
      UPDATE bookings 
      SET rentprog_id = data->>'id'
      WHERE rentprog_id IS NULL 
        AND data->>'id' IS NOT NULL
      RETURNING id
    `;
    
    console.log(`  ✅ Обновлено: ${updated.length} записей`);
    
    // Проверяем остались ли NULL
    const stillNull = await sql`
      SELECT COUNT(*) as count
      FROM bookings
      WHERE rentprog_id IS NULL
    `;
    
    if (stillNull[0].count > 0) {
      console.log(`  ⚠️  Осталось ${stillNull[0].count} записей без rentprog_id`);
      console.log('  Эти записи будут удалены...');
      
      const deleted = await sql`
        DELETE FROM bookings
        WHERE rentprog_id IS NULL
        RETURNING id
      `;
      
      console.log(`  ✅ Удалено: ${deleted.length} записей без rentprog_id`);
    }
  } else {
    console.log('  ✅ Все записи имеют rentprog_id');
  }
  console.log('');
  
  // 4. Делаем rentprog_id NOT NULL
  console.log('📋 Step 4: Установка NOT NULL на rentprog_id...\n');
  
  await sql`
    ALTER TABLE bookings 
    ALTER COLUMN rentprog_id SET NOT NULL
  `;
  console.log('  ✅ rentprog_id теперь NOT NULL\n');
  
  // 5. Создаем UNIQUE constraint на rentprog_id
  console.log('📋 Step 5: Создание UNIQUE constraint...\n');
  
  // Проверяем существование
  const existingUnique = await sql`
    SELECT indexname 
    FROM pg_indexes 
    WHERE tablename = 'bookings' 
      AND indexname = 'bookings_rentprog_id_unique'
  `;
  
  if (existingUnique.length > 0) {
    console.log('  ℹ️  bookings_rentprog_id_unique уже существует\n');
  } else {
    await sql`
      CREATE UNIQUE INDEX bookings_rentprog_id_unique 
      ON bookings (rentprog_id)
    `;
    console.log('  ✅ bookings_rentprog_id_unique создан\n');
  }
  
  // 6. Проверяем NOT NULL на branch и number
  console.log('📋 Step 6: Проверка NOT NULL на branch и number...\n');
  
  const columns = await sql`
    SELECT 
      column_name,
      is_nullable
    FROM information_schema.columns
    WHERE table_name = 'bookings'
      AND column_name IN ('branch', 'number')
    ORDER BY column_name
  `;
  
  columns.forEach(col => {
    const status = col.is_nullable === 'NO' ? '✅' : '⚠️ ';
    console.log(`  ${status} ${col.column_name}: ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULLABLE'}`);
  });
  console.log('');
  
  // 7. Добавляем комментарии
  console.log('📋 Step 7: Добавление комментариев...\n');
  
  await sql`
    COMMENT ON COLUMN bookings.rentprog_id IS 
      'Глобальный уникальный ID брони из RentProg (уникален для всей компании, не зависит от филиала)'
  `;
  
  await sql`
    COMMENT ON COLUMN bookings.branch_id IS 
      'FK на branches - fallback для определения филиала когда location_start не найден в cities'
  `;
  
  await sql`
    COMMENT ON COLUMN bookings.branch IS 
      'Денормализация кода филиала (tbilisi/batumi/kutaisi) - для быстрых запросов, НЕ источник истины'
  `;
  
  await sql`
    COMMENT ON COLUMN bookings.number IS 
      'Номер брони из RentProg - НЕ уникален глобально! Уникален только внутри филиала в RentProg UI'
  `;
  
  await sql`
    COMMENT ON COLUMN bookings.location_start IS 
      'Локация выдачи - ИСТОЧНИК ИСТИНЫ для определения филиала (через cities таблицу)'
  `;
  
  console.log('  ✅ Комментарии добавлены\n');
  
  // 8. Финальная верификация
  console.log('📋 Step 8: Финальная верификация...\n');
  
  const stats = await sql`
    SELECT 
      COUNT(*) as total_bookings,
      COUNT(rentprog_id) as has_rentprog_id,
      COUNT(branch_id) as has_branch_id,
      COUNT(CASE WHEN rentprog_id IS NULL THEN 1 END) as null_rentprog_id
    FROM bookings
  `;
  
  console.log('  Статистика:');
  console.log(`    Всего броней: ${stats[0].total_bookings}`);
  console.log(`    С rentprog_id: ${stats[0].has_rentprog_id}`);
  console.log(`    С branch_id: ${stats[0].has_branch_id}`);
  console.log(`    Без rentprog_id: ${stats[0].null_rentprog_id}`);
  console.log('');
  
  const constraints = await sql`
    SELECT 
      conname as name,
      pg_get_constraintdef(oid) as definition
    FROM pg_constraint 
    WHERE conrelid = 'bookings'::regclass
      AND conname IN ('bookings_rentprog_id_unique', 'bookings_branch_number_unique')
  `;
  
  console.log('  Constraints:');
  constraints.forEach(c => {
    console.log(`    ✅ ${c.name}: ${c.definition}`);
  });
  
  if (constraints.length === 0 || !constraints.some(c => c.name === 'bookings_rentprog_id_unique')) {
    console.log('    ⚠️  bookings_rentprog_id_unique не найден!');
  }
  
  console.log('');
  console.log('=' .repeat(60));
  console.log('');
  console.log('✅ МИГРАЦИЯ ЗАВЕРШЕНА!\n');
  console.log('📝 Изменения:');
  console.log('  1. ❌ Удален bookings_branch_number_unique (неправильный)');
  console.log('  2. ✅ Создан bookings_rentprog_id_unique (правильный)');
  console.log('  3. ✅ rentprog_id теперь NOT NULL');
  console.log('  4. ✅ branch_id существует как fallback');
  console.log('  5. ✅ Комментарии добавлены');
  console.log('');
  console.log('🎯 Следующий шаг: Обновить workflow для UPSERT по rentprog_id');
  console.log('');
}

try {
  await fixBookingsArchitecture();
} catch (err) {
  console.error('\n❌ Ошибка миграции:', err.message);
  console.error(err);
  process.exit(1);
} finally {
  await sql.end();
}

