#!/usr/bin/env node

/**
 * Удаление записей без rentprog_id
 * 
 * Эти записи - старые брони, созданные до того как мы начали
 * заполнять поле rentprog_id. Они не смогут быть обновлены
 * после миграции, поэтому их нужно удалить.
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function deleteOldBookings() {
  console.log('🗑️  Удаление броней без rentprog_id...\n');
  
  try {
    // 1. Статистика перед удалением
    const beforeStats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN rentprog_id IS NULL THEN 1 END) as null_rentprog_id,
        COUNT(CASE WHEN rentprog_id IS NOT NULL THEN 1 END) as with_rentprog_id
      FROM bookings
    `;
    
    console.log('📊 Статистика до удаления:');
    console.log(`   Всего броней: ${beforeStats[0].total}`);
    console.log(`   С rentprog_id: ${beforeStats[0].with_rentprog_id}`);
    console.log(`   Без rentprog_id: ${beforeStats[0].null_rentprog_id}`);
    
    // 2. Проверяем архивные/неактивные
    const archiveStats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN archive = true THEN 1 END) as archived,
        COUNT(CASE WHEN is_active = false THEN 1 END) as inactive
      FROM bookings
      WHERE rentprog_id IS NULL
    `;
    
    console.log(`\n📋 Статистика записей без rentprog_id:`);
    console.log(`   Архивных: ${archiveStats[0].archived}`);
    console.log(`   Неактивных: ${archiveStats[0].inactive}`);
    
    // 3. Удаляем связанные записи из car_branch_states
    console.log('\n🗑️  Удаление связанных записей из car_branch_states...');
    
    const deletedStates = await sql`
      DELETE FROM car_branch_states 
      WHERE future_booking_id IN (
        SELECT id FROM bookings WHERE rentprog_id IS NULL
      )
    `;
    
    console.log(`   ✅ Удалено из car_branch_states: ${deletedStates.count}`);
    
    // 4. Удаляем брони
    console.log('\n🗑️  Удаление броней...');
    
    const deleted = await sql`
      DELETE FROM bookings 
      WHERE rentprog_id IS NULL
    `;
    
    console.log(`   ✅ Удалено броней: ${deleted.count}`);
    
    // 4. Статистика после удаления
    const afterStats = await sql`
      SELECT COUNT(*) as total 
      FROM bookings
    `;
    
    console.log(`\n📊 Статистика после удаления:`);
    console.log(`   Осталось броней: ${afterStats[0].total}`);
    
    console.log('\n✅ Удаление завершено успешно!');
    console.log('💡 Теперь можно запускать миграцию: node setup/make_rentprog_id_primary_identifier.mjs');
    
  } catch (error) {
    console.error('\n❌ Ошибка при удалении:');
    console.error(`   ${error.message}`);
    throw error;
  } finally {
    await sql.end();
  }
}

deleteOldBookings()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Операция не выполнена');
    process.exit(1);
  });

