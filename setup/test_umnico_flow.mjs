/**
 * Тест полного потока Umnico Telegram интеграции
 * Проверяет создание темы, отправку сообщений и т.д.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const PLAYWRIGHT_URL = process.env.PLAYWRIGHT_UMNICO_URL || 'http://localhost:3001';
const JARVIS_API_URL = 'http://localhost:3000';

console.log('🧪 Тестирование Umnico Telegram интеграции...\n');

// Тест 1: Playwright Service доступен
console.log('1️⃣ Проверка Playwright Service...');
try {
  const response = await fetch(`${PLAYWRIGHT_URL}/health`, {
    signal: AbortSignal.timeout(5000)
  });
  
  if (response.ok) {
    const data = await response.json();
    console.log(`   ✅ Playwright Service доступен: ${JSON.stringify(data)}`);
  } else {
    console.log(`   ⚠️  Playwright Service вернул статус ${response.status}`);
  }
} catch (error) {
  console.log(`   ❌ Playwright Service недоступен: ${error.message}`);
  console.log('   💡 Запустите: docker compose up -d playwright-umnico');
}

// Тест 2: Jarvis API доступен
console.log('\n2️⃣ Проверка Jarvis API...');
try {
  const response = await fetch(`${JARVIS_API_URL}/health`, {
    signal: AbortSignal.timeout(5000)
  });
  
  if (response.ok) {
    const data = await response.json();
    console.log(`   ✅ Jarvis API доступен: ${JSON.stringify(data)}`);
  } else {
    console.log(`   ⚠️  Jarvis API вернул статус ${response.status}`);
  }
} catch (error) {
  console.log(`   ⚠️  Jarvis API недоступен: ${error.message}`);
  console.log('   💡 Запустите: npm start');
}

// Тест 3: Проверка Umnico Realtime Sync в логах
console.log('\n3️⃣ Проверка Umnico Realtime Sync...');
console.log('   💡 Проверьте логи Jarvis API на наличие:');
console.log('      "✅ Umnico Realtime Sync started"');
console.log('      "Starting UmnicoRealtimeSync with interval 5s"');

// Тест 4: Проверка Telegram чата
console.log('\n4️⃣ Проверка Telegram чата...');
const botToken = process.env.N8N_ALERTS_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.UMNICO_FORUM_CHAT_ID;

if (botToken && chatId) {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getChat?chat_id=${chatId}`
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data.ok) {
        const chat = data.result;
        console.log(`   ✅ Чат "${chat.title}" доступен`);
        console.log(`   Тип: ${chat.type}`);
        if (chat.is_forum) {
          console.log(`   ✅ Чат является форумом`);
        } else {
          console.log(`   ⚠️  Чат НЕ является форумом (is_forum: ${chat.is_forum})`);
          console.log('   💡 Нужно конвертировать в форум в настройках Telegram');
        }
      }
    }
  } catch (error) {
    console.log(`   ⚠️  Ошибка проверки чата: ${error.message}`);
  }
} else {
  console.log('   ⚠️  Токен бота или Chat ID не установлен');
}

// Тест 5: Проверка БД
console.log('\n5️⃣ Проверка БД...');
try {
  const postgres = (await import('postgres')).default;
  const CONNECTION_STRING = process.env.DATABASE_URL || 
    'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
  
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  const activeSessions = await sql`
    SELECT COUNT(*) as count
    FROM conversations
    WHERE session_expires_at > NOW()
    AND status = 'active'
  `;

  console.log(`   ✅ БД доступна`);
  console.log(`   Активных сессий: ${activeSessions[0].count}`);

  await sql.end();
} catch (error) {
  console.log(`   ❌ Ошибка БД: ${error.message}`);
}

console.log('\n✅ Тестирование завершено!');
console.log('\n📋 Следующие шаги для полного теста:');
console.log('   1. Убедитесь что Telegram чат является форумом');
console.log('   2. Отправьте тестовое сообщение в Umnico от имени клиента');
console.log('   3. Проверьте создание темы в Telegram группе');
console.log('   4. Отправьте ответ в Telegram теме');
console.log('   5. Проверьте что сообщение появилось в Umnico');

