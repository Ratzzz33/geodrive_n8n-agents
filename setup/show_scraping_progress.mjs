#!/usr/bin/env node

/**
 * Показать прогресс парсинга в реальном времени
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = postgres(CONNECTION_STRING, { max: 1, ssl: { rejectUnauthorized: false } });

function clearScreen() {
  // Для Windows используем cls, для Unix - clear
  if (process.platform === 'win32') {
    process.stdout.write('\x1Bc');
  } else {
    process.stdout.write('\x1B[2J\x1B[0f');
  }
}

async function showProgress() {
  try {
    // Общая статистика
    const stats = await sql`
      SELECT 
        (SELECT COUNT(*) FROM website_pages) as pages,
        (SELECT COUNT(*) FROM website_content_chunks) as chunks,
        (SELECT COUNT(*) FROM website_content_chunks WHERE embedding IS NOT NULL) as chunks_with_emb,
        (SELECT COUNT(*) FROM website_content_chunks WHERE embedding IS NULL) as chunks_without_emb
    `;
    
    // Статистика по типам страниц
    const pageTypes = await sql`
      SELECT page_type, COUNT(*) as count
      FROM website_pages
      GROUP BY page_type
      ORDER BY count DESC
    `;
    
    // Последние обработанные страницы
    const recentPages = await sql`
      SELECT url, title, page_type, scraped_at
      FROM website_pages
      ORDER BY scraped_at DESC
      LIMIT 5
    `;
    
    // Лог последнего запуска
    const lastLog = await sql`
      SELECT status, pages_found, chunks_created, started_at, completed_at, error_message
      FROM website_scraping_log
      ORDER BY started_at DESC
      LIMIT 1
    `;
    
    // Статистика чанков по типам
    const chunkTypes = await sql`
      SELECT chunk_type, COUNT(*) as count
      FROM website_content_chunks
      GROUP BY chunk_type
      ORDER BY count DESC
    `;
    
    if (process.platform === 'win32') {
      // В Windows просто выводим без очистки экрана
      console.log('\n\n');
    } else {
      clearScreen();
    }
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('     📊 ПРОГРЕСС ПАРСИНГА geodrive.info');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    // Общая статистика
    console.log('📄 СТРАНИЦЫ:');
    console.log(`   Всего обработано: ${stats[0].pages}`);
    if (pageTypes.length > 0) {
      console.log('   По типам:');
      pageTypes.forEach(pt => {
        const type = pt.page_type || 'other';
        const bar = '█'.repeat(Math.min(20, Math.floor(pt.count / Math.max(stats[0].pages, 1) * 20)));
        console.log(`     ${type.padEnd(15)} ${pt.count.toString().padStart(3)} ${bar}`);
      });
    }
    
    console.log('\n📦 ЧАНКИ:');
    console.log(`   Всего создано: ${stats[0].chunks}`);
    console.log(`   ✅ С эмбеддингами: ${stats[0].chunks_with_emb}`);
    console.log(`   ⏳ Без эмбеддингов: ${stats[0].chunks_without_emb}`);
    
    if (stats[0].chunks > 0) {
      const embPercent = Math.round((stats[0].chunks_with_emb / stats[0].chunks) * 100);
      const bar = '█'.repeat(Math.floor(embPercent / 5)) + '░'.repeat(20 - Math.floor(embPercent / 5));
      console.log(`   Прогресс: [${bar}] ${embPercent}%`);
    }
    
    if (chunkTypes.length > 0) {
      console.log('   По типам:');
      chunkTypes.forEach(ct => {
        const type = ct.chunk_type || 'other';
        console.log(`     ${type.padEnd(15)} ${ct.count.toString().padStart(4)}`);
      });
    }
    
    // Последние страницы
    if (recentPages.length > 0) {
      console.log('\n🕐 ПОСЛЕДНИЕ ОБРАБОТАННЫЕ СТРАНИЦЫ:');
      recentPages.forEach((page, i) => {
        const timeAgo = Math.floor((Date.now() - new Date(page.scraped_at)) / 1000);
        const timeStr = timeAgo < 60 ? `${timeAgo}с назад` : 
                       timeAgo < 3600 ? `${Math.floor(timeAgo / 60)}м назад` :
                       `${Math.floor(timeAgo / 3600)}ч назад`;
        const title = (page.title || 'без заголовка').substring(0, 40);
        console.log(`   ${i + 1}. ${title.padEnd(42)} [${page.page_type || 'other'}] ${timeStr}`);
      });
    }
    
    // Статус последнего запуска
    if (lastLog.length > 0) {
      const log = lastLog[0];
      console.log('\n📝 ПОСЛЕДНИЙ ЗАПУСК:');
      const statusIcon = log.status === 'success' ? '✅' : 
                        log.status === 'error' ? '❌' : '⏳';
      console.log(`   Статус: ${statusIcon} ${log.status}`);
      
      if (log.started_at) {
        const started = new Date(log.started_at);
        console.log(`   Начало: ${started.toLocaleString('ru-RU')}`);
      }
      
      if (log.completed_at) {
        const completed = new Date(log.completed_at);
        const duration = Math.floor((completed - new Date(log.started_at)) / 1000);
        console.log(`   Завершение: ${completed.toLocaleString('ru-RU')}`);
        console.log(`   Длительность: ${duration}с`);
      } else {
        const running = Math.floor((Date.now() - new Date(log.started_at)) / 1000);
        console.log(`   Работает: ${running}с`);
      }
      
      if (log.pages_found) {
        console.log(`   Страниц: ${log.pages_found}`);
      }
      if (log.chunks_created) {
        console.log(`   Чанков: ${log.chunks_created}`);
      }
      if (log.error_message) {
        console.log(`   ❌ Ошибка: ${log.error_message.substring(0, 100)}`);
      }
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log('Обновление каждые 3 секунды... (Ctrl+C для выхода)');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
}

// Показывать прогресс каждые 3 секунды
const interval = setInterval(async () => {
  await showProgress();
}, 3000);

// Показать сразу
showProgress().catch(console.error);

// Обработка выхода
process.on('SIGINT', () => {
  clearInterval(interval);
  console.log('\n\n👋 Мониторинг остановлен');
  process.exit(0);
});

