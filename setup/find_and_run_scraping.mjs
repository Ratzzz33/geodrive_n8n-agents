#!/usr/bin/env node

/**
 * Найти OpenAI API ключ и запустить парсинг
 * 
 * Ищет ключ в:
 * 1. Аргументах командной строки (--key=...)
 * 2. Переменной окружения OPENAI_API_KEY
 * 3. n8n credentials (если доступен API)
 */

import { scrapeWebsite } from './scrape_geodrive_website.mjs';
import fetch from 'node-fetch';

// Попытка получить ключ из n8n credentials
async function getKeyFromN8N() {
  const N8N_API_KEY = process.env.N8N_API_KEY || 
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
  const N8N_HOST = process.env.N8N_HOST || 'https://n8n.rentflow.rentals';
  
  try {
    const response = await fetch(`${N8N_HOST}/api/v1/credentials`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      const openaiCred = data.data?.find(c => 
        c.name?.toLowerCase().includes('openai') || 
        c.type === 'openAiApi'
      );
      
      if (openaiCred) {
        console.log(`🔍 Найден OpenAI credential в n8n: ${openaiCred.name}`);
        // К сожалению, n8n не возвращает сам ключ через API (безопасность)
        // Нужно будет указать вручную
        return null;
      }
    }
  } catch (error) {
    // Игнорируем ошибки
  }
  
  return null;
}

// Основная функция
async function main() {
  // 1. Проверить аргументы командной строки
  const keyArg = process.argv.find(arg => arg.startsWith('--key='));
  if (keyArg) {
    const apiKey = keyArg.split('=')[1];
    process.env.OPENAI_API_KEY = apiKey;
    console.log('🔑 OpenAI API ключ установлен из аргументов командной строки\n');
    await scrapeWebsite();
    return;
  }
  
  // 2. Проверить переменную окружения
  if (process.env.OPENAI_API_KEY) {
    console.log('🔑 OpenAI API ключ найден в переменной окружения\n');
    await scrapeWebsite();
    return;
  }
  
  // 3. Попытаться найти в n8n
  console.log('🔍 Поиск OpenAI API ключа в n8n credentials...');
  const n8nKey = await getKeyFromN8N();
  
  if (!n8nKey) {
    console.error('\n❌ OpenAI API ключ не найден!');
    console.error('\n📝 Укажите ключ одним из способов:');
    console.error('\n1. Через аргумент командной строки:');
    console.error('   node setup/find_and_run_scraping.mjs --key=sk-...LUMA');
    console.error('\n2. Через переменную окружения:');
    console.error('   set OPENAI_API_KEY=sk-...LUMA');
    console.error('   node setup/scrape_geodrive_website.mjs');
    console.error('\n3. Ключ должен заканчиваться на "LUMA" (как вы указали)');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

