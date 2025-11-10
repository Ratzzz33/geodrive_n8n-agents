/**
 * Проверка переменных окружения для Umnico Telegram интеграции
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем .env
dotenv.config({ path: join(__dirname, '..', '.env') });

const REQUIRED_VARS = {
  UMNICO_FORUM_CHAT_ID: 'ID Telegram чата (группы/форума)',
  UMNICO_POLLING_INTERVAL: 'Интервал polling активных чатов (секунды)',
  WEB_APP_URL: 'URL веб-приложения для просмотра истории',
  PLAYWRIGHT_UMNICO_URL: 'URL Playwright Service',
};

const OPTIONAL_VARS = {
  N8N_ALERTS_TELEGRAM_BOT_TOKEN: 'Токен бота для создания тем (можно использовать TELEGRAM_BOT_TOKEN)',
  TELEGRAM_BOT_TOKEN: 'Основной токен бота',
};

console.log('🔍 Проверка переменных окружения для Umnico Telegram интеграции...\n');

let allOk = true;
const missing = [];
const present = [];

// Проверяем обязательные переменные
for (const [varName, description] of Object.entries(REQUIRED_VARS)) {
  const value = process.env[varName];
  if (!value) {
    console.log(`❌ ${varName}: НЕ УСТАНОВЛЕН`);
    console.log(`   Описание: ${description}`);
    missing.push(varName);
    allOk = false;
  } else {
    console.log(`✅ ${varName}: ${value}`);
    present.push(varName);
  }
}

// Проверяем опциональные переменные
console.log('\n📋 Опциональные переменные:');
for (const [varName, description] of Object.entries(OPTIONAL_VARS)) {
  const value = process.env[varName];
  if (!value) {
    console.log(`⚠️  ${varName}: НЕ УСТАНОВЛЕН (${description})`);
  } else {
    console.log(`✅ ${varName}: ${value.substring(0, 20)}...`);
  }
}

// Проверяем токен бота (нужен хотя бы один)
const botToken = process.env.N8N_ALERTS_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
  console.log('\n❌ Токен бота не найден!');
  console.log('   Нужен либо N8N_ALERTS_TELEGRAM_BOT_TOKEN, либо TELEGRAM_BOT_TOKEN');
  allOk = false;
} else {
  console.log('\n✅ Токен бота найден');
}

if (!allOk) {
  console.log('\n📝 Для добавления переменных в .env файл:');
  console.log('   1. Откройте файл .env в корне проекта');
  console.log('   2. Добавьте следующие строки:\n');
  
  const examples = {
    UMNICO_FORUM_CHAT_ID: '-5015844768',
    UMNICO_POLLING_INTERVAL: '5',
    WEB_APP_URL: 'https://conversations.rentflow.rentals',
    PLAYWRIGHT_UMNICO_URL: 'http://localhost:3001',
  };
  
  missing.forEach(varName => {
    const example = examples[varName] || 'your_value_here';
    console.log(`   ${varName}=${example}`);
  });
  
  console.log('\n   Пример значений из env.example:');
  console.log('   UMNICO_FORUM_CHAT_ID=-5015844768');
  console.log('   UMNICO_POLLING_INTERVAL=5');
  console.log('   WEB_APP_URL=https://conversations.rentflow.rentals');
  console.log('   PLAYWRIGHT_UMNICO_URL=http://localhost:3001');
  
  process.exit(1);
} else {
  console.log('\n✅ Все обязательные переменные установлены!');
  process.exit(0);
}

