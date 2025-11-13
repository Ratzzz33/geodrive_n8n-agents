#!/usr/bin/env node
/**
 * Проверка статистики технических броней
 */

import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

console.log('\n📊 Статистика технических броней:\n');

try {
  // Общая статистика
  const overall = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_technical = TRUE) as technical_count,
      COUNT(*) FILTER (WHERE technical_type = 'technical_repair') as repair_count,
      COUNT(*) FILTER (WHERE technical_type = 'technical') as service_count,
      COUNT(*) FILTER (WHERE technical_type = 'regular') as regular_count
    FROM bookings
  `;
  
  console.log('🔹 Общая статистика:\n');
  console.log(`   Всего броней: ${overall[0].total}`);
  console.log(`   Технических: ${overall[0].technical_count} (${(overall[0].technical_count / overall[0].total * 100).toFixed(1)}%)`);
  console.log(`   - Для ремонта: ${overall[0].repair_count}`);
  console.log(`   - Служебных: ${overall[0].service_count}`);
  console.log(`   Обычных: ${overall[0].regular_count}\n`);
  
  // По филиалам
  const byBranch = await sql`
    SELECT 
      branch,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_technical = TRUE) as technical_count,
      COUNT(*) FILTER (WHERE technical_type = 'technical_repair') as repair_count,
      COUNT(*) FILTER (WHERE technical_type = 'technical') as service_count
    FROM bookings
    WHERE branch IS NOT NULL
    GROUP BY branch
    ORDER BY branch
  `;
  
  console.log('🔹 По филиалам:\n');
  byBranch.forEach(row => {
    console.log(`   ${(row.branch || 'NULL').toUpperCase().padEnd(15)} ${String(row.total).padStart(6)} броней`);
    if (row.technical_count > 0) {
      console.log(`      └─ Технических: ${row.technical_count} (ремонт: ${row.repair_count}, служебные: ${row.service_count})`);
    }
  });
  
  console.log('');
  
  // Примеры технических броней
  const examples = await sql`
    SELECT 
      branch,
      number,
      client_name,
      car_name,
      technical_type,
      technical_purpose,
      description
    FROM bookings
    WHERE is_technical = TRUE
    ORDER BY created_at DESC
    LIMIT 10
  `;
  
  if (examples.length > 0) {
    console.log('🔹 Примеры технических броней:\n');
    examples.forEach((ex, idx) => {
      console.log(`   ${idx + 1}. ${ex.number} | ${ex.branch}`);
      console.log(`      Клиент: ${ex.client_name || 'N/A'}`);
      console.log(`      Авто: ${ex.car_name || 'N/A'}`);
      console.log(`      Тип: ${ex.technical_type} (${ex.technical_purpose || 'N/A'})`);
      if (ex.description) {
        console.log(`      Описание: ${ex.description.substring(0, 100)}${ex.description.length > 100 ? '...' : ''}`);
      }
      console.log('');
    });
  } else {
    console.log('⚠️  Технических броней не найдено. Возможно, нужно запустить workflow.\n');
  }
  
  // Последнее обновление
  const lastUpdate = await sql`
    SELECT MAX(updated_at) as last_update
    FROM bookings
  `;
  
  if (lastUpdate[0].last_update) {
    console.log(`🕐 Последнее обновление: ${new Date(lastUpdate[0].last_update).toLocaleString('ru-RU')}\n`);
  }
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
} finally {
  await sql.end();
}

