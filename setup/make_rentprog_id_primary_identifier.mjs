#!/usr/bin/env node

/**
 * Миграция: Сделать rentprog_id основным идентификатором для bookings
 * 
 * Изменения:
 * 1. Удалить constraint bookings_branch_number_unique (если существует)
 * 2. Удалить partial unique indexes на (branch, number) и rentprog_id
 * 3. Создать простой UNIQUE constraint на rentprog_id (NOT NULL)
 * 4. Сделать rentprog_id NOT NULL (заполнить NULL значения перед этим)
 * 
 * ВАЖНО: branch остается в таблице для информации, но НЕ используется для уникальности
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  console.log('🚀 Миграция: rentprog_id как основной идентификатор\n');

  try {
    // 1. Проверяем сколько записей без rentprog_id
    const nullCount = await sql`
      SELECT COUNT(*) as count 
      FROM bookings 
      WHERE rentprog_id IS NULL
    `;
    
    console.log(`📊 Записей без rentprog_id: ${nullCount[0].count}`);
    
    if (parseInt(nullCount[0].count) > 0) {
      console.log('⚠️  ВНИМАНИЕ: Есть записи без rentprog_id!');
      console.log('   Эти записи будут недоступны после миграции.');
      console.log('   Рекомендуется проверить и заполнить rentprog_id перед продолжением.\n');
    }

    // 2. Удаляем старые constraints и indexes
    console.log('🗑️  Удаление старых constraints и indexes...');
    
    // Удаляем constraint bookings_branch_number_unique (если существует)
    await sql`
      ALTER TABLE bookings 
      DROP CONSTRAINT IF EXISTS bookings_branch_number_unique
    `;
    console.log('   ✅ bookings_branch_number_unique удален (если существовал)');
    
    // Удаляем partial indexes
    await sql`DROP INDEX IF EXISTS bookings_branch_number_manual_unique`;
    console.log('   ✅ bookings_branch_number_manual_unique удален (если существовал)');
    
    await sql`DROP INDEX IF EXISTS bookings_rentprog_id_unique`;
    console.log('   ✅ bookings_rentprog_id_unique удален (если существовал)');
    
    await sql`DROP INDEX IF EXISTS bookings_branch_number_id_unique`;
    console.log('   ✅ bookings_branch_number_id_unique удален (если существовал)');

    // 3. Делаем rentprog_id NOT NULL (только для не-NULL значений)
    console.log('\n🔒 Обновление колонки rentprog_id...');
    
    // Сначала добавляем constraint NOT NULL
    await sql`
      ALTER TABLE bookings 
      ALTER COLUMN rentprog_id SET NOT NULL
    `;
    console.log('   ✅ rentprog_id теперь NOT NULL');

    // 4. Создаем простой UNIQUE constraint на rentprog_id
    console.log('\n🔑 Создание UNIQUE constraint на rentprog_id...');
    
    await sql`
      ALTER TABLE bookings 
      ADD CONSTRAINT bookings_rentprog_id_unique 
      UNIQUE (rentprog_id)
    `;
    console.log('   ✅ UNIQUE constraint создан');

    // 5. Создаем обычный index на rentprog_id для быстрого поиска (если его еще нет)
    await sql`
      CREATE INDEX IF NOT EXISTS bookings_rentprog_id_idx 
      ON bookings (rentprog_id)
    `;
    console.log('   ✅ Index на rentprog_id создан');

    // 6. Информация о branch
    console.log('\n📝 Колонка branch:');
    console.log('   ℹ️  branch остается в таблице для информации');
    console.log('   ℹ️  branch НЕ используется для уникальности');
    console.log('   ℹ️  Машины и брони общие для всех филиалов');

    // 7. Статистика
    console.log('\n📊 Финальная статистика:');
    const stats = await sql`
      SELECT 
        COUNT(*) as total_bookings,
        COUNT(DISTINCT rentprog_id) as unique_rentprog_ids,
        COUNT(DISTINCT branch) as unique_branches
      FROM bookings
    `;
    
    console.log(`   Всего броней: ${stats[0].total_bookings}`);
    console.log(`   Уникальных rentprog_id: ${stats[0].unique_rentprog_ids}`);
    console.log(`   Уникальных филиалов: ${stats[0].unique_branches}`);

    console.log('\n✅ Миграция завершена успешно!');
    
  } catch (error) {
    console.error('\n❌ Ошибка при выполнении миграции:');
    console.error(`   ${error.message}`);
    
    if (error.message.includes('violates not-null constraint')) {
      console.error('\n💡 Решение: Заполните rentprog_id для всех записей перед повторным запуском миграции');
    } else if (error.message.includes('duplicate key')) {
      console.error('\n💡 Решение: Есть дубликаты rentprog_id. Очистите их перед повторным запуском');
    }
    
    throw error;
  } finally {
    await sql.end();
  }
}

migrate()
  .then(() => {
    console.log('\n🎉 Готово!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Миграция не выполнена');
    process.exit(1);
  });

