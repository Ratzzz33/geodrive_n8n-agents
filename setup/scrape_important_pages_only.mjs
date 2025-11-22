#!/usr/bin/env node

/**
 * Парсинг только важных страниц для обучения агента
 * 
 * Парсит только:
 * - Главную страницу
 * - Страницы услуг (первые 10)
 * - Страницу "О нас"
 * - Страницу контактов
 */

import postgres from 'postgres';
import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';
import { randomUUID as uuidv4 } from 'crypto';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const BASE_URL = 'https://geodrive.info';

// Увеличиваем размер чанка для меньшего количества
const CHUNK_SIZE = 2000; // Было 1000, теперь 2000
const CHUNK_OVERLAP = 300; // Было 200, теперь 300

const sql = postgres(CONNECTION_STRING, { max: 1, ssl: { rejectUnauthorized: false } });

// Список важных страниц для парсинга
const IMPORTANT_PAGES = [
  'https://geodrive.info',                    // Главная
  'https://geodrive.info/about',             // О нас
  'https://geodrive.info/contact',           // Контакты
  'https://geodrive.info/services',          // Услуги
  'https://geodrive.info/cars',              // Автопарк
  'https://geodrive.info/prices',            // Цены
  'https://geodrive.info/faq',              // FAQ
];

// Функции из основного скрипта (копируем нужные)
async function fetchPage(url) {
  try {
    console.log(`📥 Загрузка: ${url}`);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 30000
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (error) {
    console.error(`❌ Ошибка: ${error.message}`);
    return null;
  }
}

function parsePage(html, url) {
  const dom = new JSDOM(html, { url });
  const document = dom.window.document;
  const scripts = document.querySelectorAll('script, style, noscript');
  scripts.forEach(el => el.remove());
  
  const title = document.querySelector('title')?.textContent || '';
  const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  
  const headings = [];
  for (let level = 1; level <= 6; level++) {
    document.querySelectorAll(`h${level}`).forEach(h => {
      headings.push({ level, text: h.textContent.trim() });
    });
  }
  
  let mainElement = document.querySelector('main') || 
                    document.querySelector('article') || 
                    document.querySelector('[role="main"]') ||
                    document.body;
  
  const unwanted = mainElement.querySelectorAll('nav, footer, header, aside, .sidebar, .menu, .navigation');
  unwanted.forEach(el => el.remove());
  
  const mainContent = mainElement.textContent || '';
  const textContent = mainContent.replace(/\s+/g, ' ').trim();
  
  const path = new URL(url).pathname;
  let pageType = 'other';
  if (path === '/' || path === '') pageType = 'home';
  else if (path.includes('/about')) pageType = 'about';
  else if (path.includes('/services')) pageType = 'services';
  else if (path.includes('/contact')) pageType = 'contact';
  else if (path.includes('/cars')) pageType = 'cars';
  else if (path.includes('/price')) pageType = 'pricing';
  else if (path.includes('/faq')) pageType = 'faq';
  
  return { title, description: metaDescription, htmlContent: html, textContent, mainContent: textContent, headings, pageType };
}

function chunkText(text, maxSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + maxSize, text.length);
    let chunk = text.slice(start, end);
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

async function createEmbedding(text) {
  if (!OPENAI_API_KEY) return null;
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
    if (!response.ok) throw new Error(`OpenAI API error: ${await response.text()}`);
    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('❌ Ошибка создания эмбеддинга:', error.message);
    return null;
  }
}

async function savePage(url, parsedData) {
  try {
    const [page] = await sql`
      INSERT INTO website_pages (url, title, description, html_content, text_content, main_content, headings, page_type, language)
      VALUES (${url}, ${parsedData.title}, ${parsedData.description}, ${parsedData.htmlContent}, ${parsedData.textContent}, ${parsedData.mainContent}, ${JSON.stringify(parsedData.headings)}, ${parsedData.pageType}, 'ru')
      ON CONFLICT (url) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        html_content = EXCLUDED.html_content,
        text_content = EXCLUDED.text_content,
        main_content = EXCLUDED.main_content,
        headings = EXCLUDED.headings,
        updated_at = now()
      RETURNING id
    `;
    
    const pageId = page.id;
    console.log(`✅ Страница сохранена: ${url}`);
    
    const chunks = chunkText(parsedData.mainContent || parsedData.textContent);
    console.log(`📦 Создано ${chunks.length} чанков`);
    
    let chunksSaved = 0;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await createEmbedding(chunk);
      let chunkType = 'paragraph';
      if (chunk.length < 100) chunkType = 'heading';
      else if (chunk.includes('\n-') || chunk.includes('\n•')) chunkType = 'list';
      
      await sql`
        INSERT INTO website_content_chunks (id, page_id, content, chunk_index, chunk_type, embedding)
        VALUES (${uuidv4()}, ${pageId}, ${chunk}, ${i}, ${chunkType}, ${embedding ? JSON.stringify(embedding) : null})
      `;
      
      chunksSaved++;
      if (embedding && i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`✅ Сохранено ${chunksSaved} чанков\n`);
    return { pageId, chunksCount: chunksSaved };
  } catch (error) {
    console.error(`❌ Ошибка: ${error.message}`);
    throw error;
  }
}

async function scrapeImportantPages() {
  console.log('🚀 Парсинг только важных страниц geodrive.info\n');
  console.log(`📋 Будут обработаны ${IMPORTANT_PAGES.length} страниц\n`);
  
  await sql`SELECT 1`;
  console.log('✅ Подключение к БД установлено\n');
  
  let pagesProcessed = 0;
  let totalChunks = 0;
  
  for (const url of IMPORTANT_PAGES) {
    pagesProcessed++;
    console.log(`[${pagesProcessed}/${IMPORTANT_PAGES.length}] ${url}`);
    
    const html = await fetchPage(url);
    if (!html) continue;
    
    const parsedData = parsePage(html, url);
    const { chunksCount } = await savePage(url, parsedData);
    totalChunks += chunksCount;
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`\n✅ Парсинг завершен!`);
  console.log(`📄 Страниц: ${pagesProcessed}`);
  console.log(`📦 Чанков: ${totalChunks}`);
  
  await sql.end();
}

scrapeImportantPages().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

