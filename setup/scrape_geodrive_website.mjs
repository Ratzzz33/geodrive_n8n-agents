#!/usr/bin/env node

/**
 * Скрипт для парсинга сайта geodrive.info и сохранения в векторную БД
 * 
 * Процесс:
 * 1. Находит все страницы сайта (через sitemap или обход ссылок)
 * 2. Парсит HTML каждой страницы
 * 3. Извлекает структурированный контент
 * 4. Разбивает на чанки
 * 5. Создает эмбеддинги (через OpenAI API)
 * 6. Сохраняет в БД
 */

import postgres from 'postgres';
import { JSDOM } from 'jsdom';
// Readability будет использоваться через jsdom для извлечения основного контента
// Пока используем упрощенный парсинг
import fetch from 'node-fetch';
import { randomUUID as uuidv4 } from 'crypto';

// Конфигурация
const CONNECTION_STRING = process.env.NEON_CONNECTION_STRING || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

// OpenAI API ключ - можно установить через переменную окружения или передать при запуске
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.argv.find(arg => arg.startsWith('--key='))?.split('=')[1];
const BASE_URL = 'https://geodrive.info';
const MAX_PAGES = 100; // Лимит страниц для парсинга
const CHUNK_SIZE = 1000; // Размер чанка в символах
const CHUNK_OVERLAP = 200; // Перекрытие между чанками

// Инициализация БД
const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

// Найденные URL (для обхода)
const visitedUrls = new Set();
const urlsToVisit = new Set([BASE_URL]);

/**
 * Получить HTML страницы
 */
async function fetchPage(url) {
  try {
    console.log(`📥 Загрузка: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    return html;
  } catch (error) {
    console.error(`❌ Ошибка загрузки ${url}:`, error.message);
    return null;
  }
}

/**
 * Извлечь все ссылки со страницы
 */
function extractLinks(html, currentUrl) {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const links = [];
  
  const anchorTags = document.querySelectorAll('a[href]');
  for (const a of anchorTags) {
    const href = a.getAttribute('href');
    if (!href) continue;
    
    // Преобразовать относительные URL в абсолютные
    let absoluteUrl;
    try {
      absoluteUrl = new URL(href, currentUrl).href;
    } catch {
      continue;
    }
    
    // Фильтровать только страницы geodrive.info
    if (absoluteUrl.startsWith(BASE_URL) && 
        !absoluteUrl.includes('#') && 
        !absoluteUrl.includes('mailto:') &&
        !absoluteUrl.includes('tel:')) {
      links.push({
        url: absoluteUrl.split('#')[0], // Убрать якоря
        text: a.textContent.trim()
      });
    }
  }
  
  return links;
}

/**
 * Парсинг HTML страницы
 */
function parsePage(html, url) {
  const dom = new JSDOM(html, { url });
  const document = dom.window.document;
  
  // Удалить скрипты и стили
  const scripts = document.querySelectorAll('script, style, noscript');
  scripts.forEach(el => el.remove());
  
  // Метаданные
  const title = document.querySelector('title')?.textContent || '';
  const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  const metaKeywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '';
  
  // Извлечь заголовки
  const headings = [];
  for (let level = 1; level <= 6; level++) {
    const hTags = document.querySelectorAll(`h${level}`);
    for (const h of hTags) {
      headings.push({
        level,
        text: h.textContent.trim()
      });
    }
  }
  
  // Извлечь ссылки
  const links = extractLinks(html, url);
  
  // Извлечь изображения
  const images = [];
  const imgTags = document.querySelectorAll('img[src]');
  for (const img of imgTags) {
    const src = img.getAttribute('src');
    const alt = img.getAttribute('alt') || '';
    let absoluteSrc;
    try {
      absoluteSrc = new URL(src, url).href;
    } catch {
      continue;
    }
    images.push({ url: absoluteSrc, alt });
  }
  
  // Извлечь основной контент (main, article, или body)
  let mainElement = document.querySelector('main') || 
                    document.querySelector('article') || 
                    document.querySelector('[role="main"]') ||
                    document.body;
  
  // Удалить навигацию, футер, сайдбары
  const unwanted = mainElement.querySelectorAll('nav, footer, header, aside, .sidebar, .menu, .navigation');
  unwanted.forEach(el => el.remove());
  
  const mainContent = mainElement.textContent || '';
  const textContent = mainContent.replace(/\s+/g, ' ').trim();
  
  // Определить тип страницы
  const path = new URL(url).pathname;
  let pageType = 'other';
  if (path === '/' || path === '') pageType = 'home';
  else if (path.includes('/about') || path.includes('/o-nas')) pageType = 'about';
  else if (path.includes('/services') || path.includes('/uslugi')) pageType = 'services';
  else if (path.includes('/contact') || path.includes('/kontakty')) pageType = 'contact';
  else if (path.includes('/blog') || path.includes('/news') || path.includes('/novosti')) pageType = 'blog';
  else if (path.includes('/cars') || path.includes('/avto') || path.includes('/avtomobili')) pageType = 'cars';
  else if (path.includes('/price') || path.includes('/tseny')) pageType = 'pricing';
  else if (path.includes('/faq') || path.includes('/voprosy')) pageType = 'faq';
  
  return {
    title,
    description: metaDescription,
    metaKeywords,
    htmlContent: html,
    textContent,
    mainContent: textContent,
    headings,
    links,
    images,
    pageType
  };
}

/**
 * Разбить текст на чанки
 */
function chunkText(text, maxSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + maxSize, text.length);
    let chunk = text.slice(start, end);
    
    // Попытаться разбить по предложениям
    if (end < text.length) {
      const lastPeriod = chunk.lastIndexOf('.');
      const lastNewline = chunk.lastIndexOf('\n');
      const breakPoint = Math.max(lastPeriod, lastNewline);
      
      if (breakPoint > maxSize * 0.5) {
        chunk = chunk.slice(0, breakPoint + 1);
        start += breakPoint + 1 - overlap;
      } else {
        start = end - overlap;
      }
    } else {
      start = end;
    }
    
    if (chunk.trim().length > 0) {
      chunks.push(chunk.trim());
    }
  }
  
  return chunks;
}

/**
 * Создать эмбеддинг через OpenAI API
 */
async function createEmbedding(text) {
  if (!OPENAI_API_KEY) {
    console.warn('⚠️ OPENAI_API_KEY не установлен, пропускаю создание эмбеддингов');
    return null;
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('❌ Ошибка создания эмбеддинга:', error.message);
    return null;
  }
}

/**
 * Сохранить страницу в БД
 */
async function savePage(url, parsedData) {
  try {
    // Сохранить страницу
    const [page] = await sql`
      INSERT INTO website_pages (
        url, title, description, meta_keywords,
        html_content, text_content, main_content,
        headings, links, images,
        page_type, language
      ) VALUES (
        ${url},
        ${parsedData.title},
        ${parsedData.description},
        ${parsedData.metaKeywords},
        ${parsedData.htmlContent},
        ${parsedData.textContent},
        ${parsedData.mainContent},
        ${JSON.stringify(parsedData.headings)},
        ${JSON.stringify(parsedData.links)},
        ${JSON.stringify(parsedData.images)},
        ${parsedData.pageType},
        'ru'
      )
      ON CONFLICT (url) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        html_content = EXCLUDED.html_content,
        text_content = EXCLUDED.text_content,
        main_content = EXCLUDED.main_content,
        headings = EXCLUDED.headings,
        links = EXCLUDED.links,
        images = EXCLUDED.images,
        updated_at = now()
      RETURNING id
    `;
    
    const pageId = page.id;
    console.log(`✅ Страница сохранена: ${url} (ID: ${pageId})`);
    
    // Разбить на чанки
    const chunks = chunkText(parsedData.mainContent || parsedData.textContent);
    console.log(`📦 Создано ${chunks.length} чанков`);
    
    // Сохранить чанки с эмбеддингами
    let chunksSaved = 0;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Создать эмбеддинг
      const embedding = await createEmbedding(chunk);
      
      // Определить тип чанка
      let chunkType = 'paragraph';
      if (chunk.length < 100) chunkType = 'heading';
      else if (chunk.includes('\n-') || chunk.includes('\n•')) chunkType = 'list';
      
      // Сохранить чанк
      await sql`
        INSERT INTO website_content_chunks (
          id, page_id, content, chunk_index,
          chunk_type, embedding
        ) VALUES (
          ${uuidv4()},
          ${pageId},
          ${chunk},
          ${i},
          ${chunkType},
          ${embedding ? JSON.stringify(embedding) : null}
        )
      `;
      
      chunksSaved++;
      
      // Небольшая задержка для API
      if (embedding && i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`✅ Сохранено ${chunksSaved} чанков для страницы ${url}`);
    
    return { pageId, chunksCount: chunksSaved };
  } catch (error) {
    console.error(`❌ Ошибка сохранения страницы ${url}:`, error);
    throw error;
  }
}

/**
 * Основная функция парсинга
 */
async function scrapeWebsite() {
  console.log('🚀 Начало парсинга сайта geodrive.info\n');
  
  // Проверить подключение к БД
  try {
    await sql`SELECT 1`;
    console.log('✅ Подключение к БД установлено\n');
  } catch (error) {
    console.error('❌ Ошибка подключения к БД:', error);
    process.exit(1);
  }
  
  let pagesProcessed = 0;
  let totalChunks = 0;
  
  // Логирование начала
  const [logEntry] = await sql`
    INSERT INTO website_scraping_log (url, status, started_at)
    VALUES (${BASE_URL}, 'pending', now())
    RETURNING id
  `;
  const logId = logEntry.id;
  
  try {
    while (urlsToVisit.size > 0 && pagesProcessed < MAX_PAGES) {
      // Взять следующий URL
      const url = urlsToVisit.values().next().value;
      urlsToVisit.delete(url);
      
      if (visitedUrls.has(url)) {
        continue;
      }
      
      visitedUrls.add(url);
      pagesProcessed++;
      
      console.log(`\n[${pagesProcessed}/${MAX_PAGES}] Обработка: ${url}`);
      
      // Загрузить страницу
      const html = await fetchPage(url);
      if (!html) {
        continue;
      }
      
      // Парсить страницу
      const parsedData = parsePage(html, url);
      
      // Сохранить в БД
      const { chunksCount } = await savePage(url, parsedData);
      totalChunks += chunksCount;
      
      // Добавить новые ссылки в очередь
      for (const link of parsedData.links) {
        if (!visitedUrls.has(link.url) && link.url.startsWith(BASE_URL)) {
          urlsToVisit.add(link.url);
        }
      }
      
      // Задержка между запросами
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Обновить лог
    await sql`
      UPDATE website_scraping_log
      SET status = 'success',
          completed_at = now(),
          pages_found = ${pagesProcessed},
          chunks_created = ${totalChunks}
      WHERE id = ${logId}
    `;
    
    console.log(`\n✅ Парсинг завершен!`);
    console.log(`📄 Страниц обработано: ${pagesProcessed}`);
    console.log(`📦 Чанков создано: ${totalChunks}`);
    console.log(`🔗 URL найдено: ${visitedUrls.size}`);
    
  } catch (error) {
    console.error('\n❌ Критическая ошибка:', error);
    
    await sql`
      UPDATE website_scraping_log
      SET status = 'error',
          error_message = ${error.message},
          completed_at = now()
      WHERE id = ${logId}
    `;
    
    throw error;
  } finally {
    await sql.end();
  }
}

// Запуск
scrapeWebsite().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { scrapeWebsite, parsePage, chunkText, createEmbedding };

