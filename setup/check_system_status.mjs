/**
 * Комплексная проверка статуса системы Umnico Telegram интеграции
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const PLAYWRIGHT_URL = process.env.PLAYWRIGHT_UMNICO_URL || 'http://localhost:3001';
const JARVIS_API_URL = 'http://localhost:3000';

console.log('🔍 Комплексная проверка системы Umnico Telegram интеграции\n');

async function checkDatabase() {
  console.log('1️⃣ Проверка базы данных...');
  try {
    const sql = postgres(CONNECTION_STRING, {
      max: 1,
      ssl: { rejectUnauthorized: false }
    });

    // Проверка миграции
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='conversations' 
        AND column_name IN ('tg_chat_id','tg_topic_id','session_expires_at','client_name','car_info','booking_dates')
    `;

    const foundColumns = columns.map(r => r.column_name);
    const requiredColumns = ['tg_chat_id', 'tg_topic_id', 'session_expires_at', 'client_name', 'car_info', 'booking_dates'];
    const missingColumns = requiredColumns.filter(c => !foundColumns.includes(c));

    if (missingColumns.length === 0) {
      console.log('   ✅ Миграция применена (все 6 колонок найдены)');
    } else {
      console.log(`   ⚠️  Миграция частично применена (найдено ${foundColumns.length}/6 колонок)`);
      console.log(`   Отсутствуют: ${missingColumns.join(', ')}`);
    }

    // Проверка существующих диалогов
    const conversations = await sql`
      SELECT COUNT(*) as count FROM conversations
    `;
    console.log(`   📊 Всего диалогов в БД: ${conversations[0].count}`);

    const activeConversations = await sql`
      SELECT COUNT(*) as count 
      FROM conversations 
      WHERE status = 'active' AND tg_topic_id IS NOT NULL
    `;
    console.log(`   📊 Активных диалогов с Telegram темами: ${activeConversations[0].count}`);

    await sql.end();
    return missingColumns.length === 0;
  } catch (error) {
    console.log(`   ❌ Ошибка подключения к БД: ${error.message}`);
    return false;
  }
}

async function checkPlaywrightService() {
  console.log('\n2️⃣ Проверка Playwright Service...');
  try {
    const response = await fetch(`${PLAYWRIGHT_URL}/health`, {
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      console.log(`   ❌ HTTP ${response.status}`);
      return false;
    }

    const data = await response.json();
    
    if (data.ok && data.initialized) {
      console.log('   ✅ Сервис запущен и инициализирован');
      console.log(`   📅 Последний логин: ${data.lastLoginAt || 'N/A'}`);
      console.log(`   🌐 URL страницы: ${data.pageUrl || 'N/A'}`);
      console.log(`   🔗 Браузер подключен: ${data.browserConnected ? 'Да' : 'Нет'}`);
      
      // Проверяем что не на странице логина
      if (data.pageUrl && data.pageUrl.includes('/login')) {
        console.log('   ⚠️  На странице логина - требуется перелогин');
        return false;
      }
      
      return true;
    } else {
      console.log('   ⚠️  Сервис запущен, но не инициализирован');
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Сервис недоступен: ${error.message}`);
    return false;
  }
}

async function checkJarvisAPI() {
  console.log('\n3️⃣ Проверка Jarvis API...');
  try {
    const response = await fetch(`${JARVIS_API_URL}/health`, {
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      console.log(`   ❌ HTTP ${response.status}`);
      return false;
    }

    const data = await response.json();
    console.log('   ✅ API доступен');
    return true;
  } catch (error) {
    console.log(`   ❌ API недоступен: ${error.message}`);
    console.log('   💡 Убедитесь что Jarvis API запущен: npm start');
    return false;
  }
}

async function checkEnvironmentVariables() {
  console.log('\n4️⃣ Проверка переменных окружения...');
  
  const required = [
    'UMNICO_FORUM_CHAT_ID',
    'UMNICO_POLLING_INTERVAL',
    'WEB_APP_URL',
    'PLAYWRIGHT_UMNICO_URL',
    'TELEGRAM_BOT_TOKEN'
  ];

  const optional = [
    'N8N_ALERTS_TELEGRAM_BOT_TOKEN'
  ];

  let allOk = true;

  for (const key of required) {
    const value = process.env[key];
    if (value) {
      console.log(`   ✅ ${key}: ${key.includes('TOKEN') ? value.substring(0, 20) + '...' : value}`);
    } else {
      console.log(`   ❌ ${key}: НЕ УСТАНОВЛЕН`);
      allOk = false;
    }
  }

  for (const key of optional) {
    const value = process.env[key];
    if (value) {
      console.log(`   ✅ ${key}: установлен`);
    } else {
      console.log(`   ⚠️  ${key}: не установлен (опционально)`);
    }
  }

  // Проверка учетных данных Umnico
  const email = process.env.UMNICO_EMAIL;
  const password = process.env.UMNICO_PASSWORD;

  if (email && password) {
    console.log(`   ✅ UMNICO_EMAIL: установлен`);
    console.log(`   ✅ UMNICO_PASSWORD: установлен`);
  } else {
    console.log(`   ⚠️  UMNICO_EMAIL: ${email ? 'установлен' : 'НЕ УСТАНОВЛЕН'}`);
    console.log(`   ⚠️  UMNICO_PASSWORD: ${password ? 'установлен' : 'НЕ УСТАНОВЛЕН'}`);
    console.log('   💡 Учетные данные нужны для Playwright Service');
  }

  return allOk;
}

async function main() {
  const results = {
    database: await checkDatabase(),
    playwright: await checkPlaywrightService(),
    jarvis: await checkJarvisAPI(),
    env: await checkEnvironmentVariables()
  };

  console.log('\n' + '='.repeat(50));
  console.log('📊 Итоговый статус:');
  console.log('='.repeat(50));
  console.log(`База данных:        ${results.database ? '✅ OK' : '❌ Проблема'}`);
  console.log(`Playwright Service: ${results.playwright ? '✅ OK' : '❌ Проблема'}`);
  console.log(`Jarvis API:          ${results.jarvis ? '✅ OK' : '❌ Проблема'}`);
  console.log(`Переменные окружения: ${results.env ? '✅ OK' : '❌ Проблема'}`);

  const allOk = Object.values(results).every(v => v);
  
  if (allOk) {
    console.log('\n✅ Все компоненты работают! Система готова к тестированию.');
  } else {
    console.log('\n⚠️  Есть проблемы. Исправьте их перед тестированием.');
  }

  process.exit(allOk ? 0 : 1);
}

main().catch(error => {
  console.error('\n❌ Критическая ошибка:', error);
  process.exit(1);
});

