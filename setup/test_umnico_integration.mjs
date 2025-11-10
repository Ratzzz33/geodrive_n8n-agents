/**
 * Тест Umnico Telegram интеграции
 * Проверяет основные компоненты без запуска сервисов
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем .env
dotenv.config({ path: join(__dirname, '..', '.env') });

console.log('🧪 Тестирование Umnico Telegram интеграции...\n');

// Проверка 1: Переменные окружения
console.log('1️⃣ Проверка переменных окружения...');
const requiredVars = [
  'UMNICO_FORUM_CHAT_ID',
  'UMNICO_POLLING_INTERVAL',
  'WEB_APP_URL',
  'PLAYWRIGHT_UMNICO_URL',
  'TELEGRAM_BOT_TOKEN'
];

let envOk = true;
for (const varName of requiredVars) {
  const value = process.env[varName];
  if (!value) {
    console.log(`   ❌ ${varName}: НЕ УСТАНОВЛЕН`);
    envOk = false;
  } else {
    console.log(`   ✅ ${varName}: ${varName.includes('TOKEN') ? value.substring(0, 20) + '...' : value}`);
  }
}

if (!envOk) {
  console.log('\n❌ Не все переменные окружения установлены');
  process.exit(1);
}

console.log('   ✅ Все переменные установлены\n');

// Проверка 2: Миграция БД
console.log('2️⃣ Проверка миграции БД...');
try {
  const postgres = (await import('postgres')).default;
  const CONNECTION_STRING = process.env.DATABASE_URL || 
    'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
  
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  const columns = await sql`
    SELECT column_name
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'conversations'
      AND column_name IN ('tg_chat_id', 'tg_topic_id', 'client_name', 'car_info', 'booking_dates', 'session_expires_at', 'assigned_employee_id')
  `;

  if (columns.length === 7) {
    console.log(`   ✅ Все ${columns.length} полей созданы`);
  } else {
    console.log(`   ⚠️  Найдено только ${columns.length}/7 полей`);
  }

  const indexes = await sql`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'conversations'
      AND indexname IN ('idx_conversations_active_sessions', 'idx_conversations_tg_topic', 'idx_conversations_assigned_employee')
  `;

  if (indexes.length === 3) {
    console.log(`   ✅ Все ${indexes.length} индекса созданы`);
  } else {
    console.log(`   ⚠️  Найдено только ${indexes.length}/3 индексов`);
  }

  await sql.end();
  console.log('   ✅ Миграция БД применена\n');
} catch (error) {
  console.log(`   ❌ Ошибка проверки БД: ${error.message}\n`);
}

// Проверка 3: Telegram чат
console.log('3️⃣ Проверка Telegram чата...');
try {
  const botToken = process.env.N8N_ALERTS_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.UMNICO_FORUM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error('Токен бота или Chat ID не установлен');
  }

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/getChat?chat_id=${chatId}`
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.ok) {
    throw new Error(data.description || 'Unknown error');
  }

  const chat = data.result;
  
  if (chat.type === 'supergroup' && chat.is_forum === true) {
    console.log(`   ✅ Чат "${chat.title}" является форумом`);
    console.log(`   ✅ ID: ${chat.id}`);
  } else {
    console.log(`   ⚠️  Чат "${chat.title}" не является форумом (type: ${chat.type}, is_forum: ${chat.is_forum})`);
  }
  
  console.log('   ✅ Telegram чат доступен\n');
} catch (error) {
  console.log(`   ❌ Ошибка проверки Telegram чата: ${error.message}\n`);
}

// Проверка 4: Playwright Service
console.log('4️⃣ Проверка Playwright Service...');
try {
  const playwrightUrl = process.env.PLAYWRIGHT_UMNICO_URL || 'http://localhost:3001';
  
  const response = await fetch(`${playwrightUrl}/health`, {
    method: 'GET',
    signal: AbortSignal.timeout(5000)
  });

  if (response.ok) {
    console.log(`   ✅ Playwright Service доступен по адресу ${playwrightUrl}`);
  } else {
    console.log(`   ⚠️  Playwright Service вернул статус ${response.status}`);
  }
} catch (error) {
  if (error.name === 'AbortError') {
    console.log(`   ⚠️  Playwright Service не отвечает (таймаут)`);
  } else if (error.code === 'ECONNREFUSED') {
    console.log(`   ⚠️  Playwright Service не запущен (connection refused)`);
  } else {
    console.log(`   ⚠️  Playwright Service недоступен: ${error.message}`);
  }
  console.log('   💡 Убедитесь что Playwright Service запущен: docker compose up -d playwright-umnico');
}

console.log('\n✅ Базовые проверки завершены!');
console.log('\n📋 Следующие шаги:');
console.log('   1. Запустите Playwright Service: docker compose up -d playwright-umnico');
console.log('   2. Запустите Jarvis API: npm start');
console.log('   3. Отправьте тестовое сообщение в Umnico');
console.log('   4. Проверьте создание темы в Telegram');

