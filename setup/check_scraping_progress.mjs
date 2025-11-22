#!/usr/bin/env node

/**
 * Проверить прогресс парсинга сайта
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.NEON_CONNECTION_STRING || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkProgress() {
  try {
    // Статистика страниц
    const pagesStats = await sql`
      SELECT 
        COUNT(*) as total_pages,
        COUNT(DISTINCT page_type) as page_types_count,
        SUM(CASE WHEN scraped_at > NOW() - INTERVAL '1 hour' THEN 1 ELSE 0 END) as recent_pages
      FROM website_pages
    `;
    
    // Статистика чанков
    const chunksStats = await sql`
      SELECT 
        COUNT(*) as total_chunks,
        COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as chunks_with_embeddings,
        COUNT(DISTINCT page_id) as pages_with_chunks
      FROM website_content_chunks
    `;
    
    // Статистика по типам страниц
    const pageTypes = await sql`
      SELECT page_type, COUNT(*) as count
      FROM website_pages
      GROUP BY page_type
      ORDER BY count DESC
    `;
    
    // Последние страницы
    const recentPages = await sql`
      SELECT url, title, page_type, scraped_at
      FROM website_pages
      ORDER BY scraped_at DESC
      LIMIT 5
    `;
    
    // Лог парсинга
    const logs = await sql`
      SELECT status, pages_found, chunks_created, started_at, completed_at, error_message
      FROM website_scraping_log
      ORDER BY started_at DESC
      LIMIT 3
    `;
    
    console.log('📊 Статистика парсинга geodrive.info\n');
    console.log('📄 Страницы:');
    console.log(`  Всего: ${pagesStats[0].total_pages}`);
    console.log(`  Типов страниц: ${pagesStats[0].page_types_count}`);
    console.log(`  За последний час: ${pagesStats[0].recent_pages}`);
    
    console.log('\n📦 Чанки:');
    console.log(`  Всего: ${chunksStats[0].total_chunks}`);
    console.log(`  С эмбеддингами: ${chunksStats[0].chunks_with_embeddings}`);
    console.log(`  Страниц с чанками: ${chunksStats[0].pages_with_chunks}`);
    
    if (pageTypes.length > 0) {
      console.log('\n📋 Типы страниц:');
      for (const pt of pageTypes) {
        console.log(`  ${pt.page_type || 'other'}: ${pt.count}`);
      }
    }
    
    if (recentPages.length > 0) {
      console.log('\n🕐 Последние обработанные страницы:');
      for (const page of recentPages) {
        const timeAgo = new Date() - new Date(page.scraped_at);
        const minutesAgo = Math.floor(timeAgo / 60000);
        console.log(`  ${page.url} (${page.page_type || 'other'}) - ${minutesAgo} мин назад`);
      }
    }
    
    if (logs.length > 0) {
      console.log('\n📝 Последние запуски:');
      for (const log of logs) {
        const status = log.status === 'success' ? '✅' : log.status === 'error' ? '❌' : '⏳';
        console.log(`  ${status} ${log.status} - ${log.pages_found || 0} страниц, ${log.chunks_created || 0} чанков`);
        if (log.error_message) {
          console.log(`     Ошибка: ${log.error_message.substring(0, 100)}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
}

checkProgress();

