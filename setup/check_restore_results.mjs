#!/usr/bin/env node
/**
 * Проверка результатов восстановления машин
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkResults() {
  console.log('🔍 Проверка результатов восстановления машин...\n');
  
  // Проверяем общее количество машин
  const totalCars = await sql`SELECT COUNT(*) as count FROM cars`;
  console.log(`📊 Всего машин в БД: ${totalCars[0].count}`);
  
  // Проверяем обновления за последние 30 минут
  const recentUpdates = await sql`
    SELECT COUNT(*) as count 
    FROM cars 
    WHERE updated_at > NOW() - INTERVAL '30 minutes'
  `;
  console.log(`🔄 Обновлено за последние 30 минут: ${recentUpdates[0].count}`);
  
  // Проверяем добавления за последние 30 минут
  const recentInserts = await sql`
    SELECT COUNT(*) as count 
    FROM cars 
    WHERE created_at > NOW() - INTERVAL '30 minutes'
  `;
  console.log(`➕ Добавлено за последние 30 минут: ${recentInserts[0].count}`);
  
  // Статистика по филиалам
  console.log('\n📋 По филиалам:');
  const byBranch = await sql`
    SELECT 
      b.code as branch,
      COUNT(c.id) as total,
      COUNT(CASE WHEN c.updated_at > NOW() - INTERVAL '30 minutes' THEN 1 END) as updated,
      COUNT(CASE WHEN c.created_at > NOW() - INTERVAL '30 minutes' THEN 1 END) as inserted
    FROM branches b
    LEFT JOIN cars c ON c.branch_id = b.id
    GROUP BY b.code
    ORDER BY b.code
  `;
  
  for (const row of byBranch) {
    console.log(`  ${row.branch}: ${row.total} машин (обновлено: ${row.updated}, добавлено: ${row.inserted})`);
  }
  
  // Последние обновленные машины
  console.log('\n🚗 Последние 5 обновленных машин:');
  const lastUpdated = await sql`
    SELECT c.plate, c.model, c.state, b.code as branch, c.updated_at
    FROM cars c
    LEFT JOIN branches b ON b.id = c.branch_id
    ORDER BY c.updated_at DESC
    LIMIT 5
  `;
  
  for (const car of lastUpdated) {
    console.log(`  ${car.plate || 'N/A'} - ${car.model || 'N/A'} (${car.branch || 'N/A'}) - ${car.updated_at.toISOString()}`);
  }
  
  await sql.end();
  console.log('\n✅ Проверка завершена!');
}

checkResults().catch(error => {
  console.error('❌ Ошибка:', error);
  process.exit(1);
});

