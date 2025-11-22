#!/usr/bin/env node

/**
 * Исправление ambiguous rentprog_id в таблице cars
 * 
 * Проблема: Два индекса на rentprog_id создают неоднозначность:
 * - idx_cars_rentprog_id (старый) - на (data ->> 'id')
 * - idx_cars_rentprog_id_text (новый) - на rentprog_id
 * 
 * Решение: Удалить старый индекс
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function fixAmbiguousRentprogId() {
  console.log('🔧 Исправление ambiguous rentprog_id в таблице cars...\n');

  try {
    // Удаляем старый индекс на (data ->> 'id')
    console.log('1️⃣ Удаление старого индекса idx_cars_rentprog_id...');
    await sql`DROP INDEX IF EXISTS idx_cars_rentprog_id`;
    console.log('   ✅ Старый индекс удален\n');

    // Проверяем что осталось
    console.log('2️⃣ Проверка оставшихся индексов на rentprog_id:');
    const indexes = await sql`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'cars'
        AND (indexname LIKE '%rentprog%' OR indexdef LIKE '%rentprog%')
      ORDER BY indexname
    `;

    if (indexes.length > 0) {
      indexes.forEach(idx => {
        console.log(`   ✅ ${idx.indexname}:`);
        console.log(`      ${idx.indexdef}`);
      });
    } else {
      console.log('   ⚠️ Индексы на rentprog_id не найдены');
    }

    console.log('\n✅ Исправление применено!');
    console.log('\n📝 Теперь в таблице cars:');
    console.log('   - Колонка: rentprog_id (TEXT)');
    console.log('   - Constraint: cars_rentprog_id_unique (UNIQUE)');
    console.log('   - Индекс: idx_cars_rentprog_id_text (на rentprog_id)');
    console.log('\n🎯 Workflow "Парсинг автомобилей" теперь должен работать!');

  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

fixAmbiguousRentprogId().catch(console.error);

