#!/usr/bin/env node

/**
 * Проверка записей без rentprog_id
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  console.log('🔍 Проверка записей без rentprog_id...\n');
  
  try {
    // Проверяем количество NULL
    const nullCount = await sql`
      SELECT COUNT(*) as count 
      FROM bookings 
      WHERE rentprog_id IS NULL
    `;
    
    console.log(`📊 Записей без rentprog_id: ${nullCount[0].count}`);
    
    if (parseInt(nullCount[0].count) > 0) {
      console.log('\n📋 Примеры записей без rentprog_id:');
      const examples = await sql`
        SELECT id, branch, number, car_code, created_at 
        FROM bookings 
        WHERE rentprog_id IS NULL 
        LIMIT 10
      `;
      
      examples.forEach((row, i) => {
        console.log(`   ${i + 1}. ID: ${row.id}, Branch: ${row.branch}, Number: ${row.number}, Car: ${row.car_code}`);
      });
      
      console.log('\n⚠️  Эти записи НЕ смогут быть обновлены после миграции!');
      console.log('💡 Рекомендация: Удалить их или заполнить rentprog_id');
    } else {
      console.log('✅ Все записи имеют rentprog_id. Можно выполнять миграцию.');
    }
    
    // Проверяем дубликаты rentprog_id
    const duplicates = await sql`
      SELECT rentprog_id, COUNT(*) as count 
      FROM bookings 
      WHERE rentprog_id IS NOT NULL
      GROUP BY rentprog_id 
      HAVING COUNT(*) > 1
    `;
    
    if (duplicates.length > 0) {
      console.log(`\n⚠️  Найдено ${duplicates.length} дублирующихся rentprog_id:`);
      duplicates.slice(0, 10).forEach((row, i) => {
        console.log(`   ${i + 1}. rentprog_id: ${row.rentprog_id}, count: ${row.count}`);
      });
      console.log('\n💡 Рекомендация: Очистить дубликаты перед миграцией');
    } else {
      console.log('✅ Дубликатов rentprog_id не найдено');
    }
    
  } finally {
    await sql.end();
  }
}

check().catch(console.error);

