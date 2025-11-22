#!/usr/bin/env node

/**
 * Остановить текущий парсинг и перезапустить только важные страницы
 */

import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {max:1, ssl:{rejectUnauthorized:false}});

console.log('🛑 Очистка данных для перезапуска с важными страницами...\n');

try {
  // Удалить все чанки
  const chunksDeleted = await sql`DELETE FROM website_content_chunks`;
  console.log(`✅ Удалено чанков: ${chunksDeleted.count || 0}`);
  
  // Удалить все страницы
  const pagesDeleted = await sql`DELETE FROM website_pages`;
  console.log(`✅ Удалено страниц: ${pagesDeleted.count || 0}`);
  
  console.log('\n✅ Данные очищены. Готово к парсингу только важных страниц!\n');
  console.log('📋 Запустите: node setup/scrape_important_pages_only.mjs\n');
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
} finally {
  await sql.end();
}

