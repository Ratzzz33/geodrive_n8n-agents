#!/usr/bin/env node

/**
 * Запуск парсинга с OpenAI API ключом
 * 
 * Использование:
 * node setup/run_scraping_with_openai.mjs --key=sk-...LUMA
 * 
 * Или установите переменную окружения:
 * set OPENAI_API_KEY=sk-...LUMA
 * node setup/scrape_geodrive_website.mjs
 */

import { scrapeWebsite } from './scrape_geodrive_website.mjs';

// Получить ключ из аргументов командной строки
const keyArg = process.argv.find(arg => arg.startsWith('--key='));
const apiKey = keyArg ? keyArg.split('=')[1] : process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('❌ OpenAI API ключ не найден!');
  console.error('\nИспользование:');
  console.error('  node setup/run_scraping_with_openai.mjs --key=sk-...LUMA');
  console.error('\nИли установите переменную окружения:');
  console.error('  set OPENAI_API_KEY=sk-...LUMA');
  console.error('  node setup/scrape_geodrive_website.mjs');
  process.exit(1);
}

// Установить ключ в переменную окружения
process.env.OPENAI_API_KEY = apiKey;

console.log('🔑 OpenAI API ключ установлен (начинается с: sk-...' + apiKey.slice(-4) + ')\n');

// Запустить парсинг
scrapeWebsite().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

