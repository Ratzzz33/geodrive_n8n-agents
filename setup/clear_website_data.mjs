#!/usr/bin/env node

/**
 * Очистить старые данные парсинга перед новым запуском
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = postgres(CONNECTION_STRING, { max: 1, ssl: { rejectUnauthorized: false } });

async function clearData() {
  console.log('🧹 Очистка старых данных парсинга...\n');
  
  try {
    // Удалить чанки (каскадно удалит связанные данные)
    const chunksDeleted = await sql`DELETE FROM website_content_chunks`;
    console.log(`✅ Удалено чанков: ${chunksDeleted.count || 0}`);
    
    // Удалить страницы
    const pagesDeleted = await sql`DELETE FROM website_pages`;
    console.log(`✅ Удалено страниц: ${pagesDeleted.count || 0}`);
    
    // Очистить лог (опционально, можно оставить для истории)
    // await sql`DELETE FROM website_scraping_log`;
    
    console.log('\n✅ Данные очищены. Готово к новому парсингу!\n');
  } catch (error) {
    console.error('❌ Ошибка очистки:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

clearData();

