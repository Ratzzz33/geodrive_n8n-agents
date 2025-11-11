/**
 * Ожидание и поиск тестового сообщения
 * Запуск: node setup/wait_and_find_test.mjs "ТЕКСТ_СООБЩЕНИЯ"
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const PLAYWRIGHT_URL = process.env.PLAYWRIGHT_UMNICO_URL || 'http://localhost:3001';
const JARVIS_API_URL = 'http://localhost:3000';
const SEARCH_TEXT = process.argv[2];

if (!SEARCH_TEXT) {
  console.log('❌ Укажите текст для поиска:');
  console.log('   node setup/wait_and_find_test.mjs "ТЕКСТ_СООБЩЕНИЯ"');
  process.exit(1);
}

console.log(`🔍 Ожидание и поиск сообщения "${SEARCH_TEXT}"...\n`);

async function checkPlaywrightService() {
  try {
    const response = await fetch(`${PLAYWRIGHT_URL}/health`, {
      signal: AbortSignal.timeout(3000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function findMessage() {
  try {
    const response = await fetch(`${PLAYWRIGHT_URL}/api/conversations`);
    if (!response.ok) return null;

    const data: any = await response.json();
    if (!data.ok) return null;

    const conversations = data.data || [];

    for (const conv of conversations) {
      try {
        const msgResponse = await fetch(
          `${PLAYWRIGHT_URL}/api/conversations/${conv.id}/messages`
        );
        if (!msgResponse.ok) continue;

        const msgData: any = await msgResponse.json();
        const messages = msgData.data || [];

        const found = messages.find((m: any) => 
          m.text && m.text.toUpperCase().includes(SEARCH_TEXT.toUpperCase())
        );

        if (found) {
          return { conversation: conv, message: found };
        }
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function checkTelegramTopic(conversationId) {
  try {
    const postgres = (await import('postgres')).default;
    const CONNECTION_STRING = process.env.DATABASE_URL || 
      'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
    
    const sql = postgres(CONNECTION_STRING, {
      max: 1,
      ssl: { rejectUnauthorized: false }
    });

    const result = await sql`
      SELECT tg_chat_id, tg_topic_id, client_name, status, session_expires_at
      FROM conversations
      WHERE umnico_conversation_id = ${conversationId}
      LIMIT 1
    `;

    await sql.end();
    return result[0] || null;
  } catch {
    return null;
  }
}

// Основной цикл поиска
let attempts = 0;
const maxAttempts = 60; // 5 минут (каждые 5 секунд)

console.log('⏳ Ожидание сообщения (проверка каждые 5 секунд, максимум 5 минут)...\n');

const interval = setInterval(async () => {
  attempts++;

  // Проверяем Playwright Service
  if (attempts === 1 || attempts % 6 === 0) {
    const playwrightOk = await checkPlaywrightService();
    if (!playwrightOk) {
      console.log(`⚠️  [${attempts}] Playwright Service недоступен, ожидание...`);
      return;
    }
  }

  // Ищем сообщение
  const found = await findMessage();

  if (found) {
    clearInterval(interval);
    
    console.log('\n✅ Сообщение найдено!');
    console.log(`\n📋 Информация о диалоге:`);
    console.log(`   Umnico Conversation ID: ${found.conversation.id}`);
    console.log(`   Клиент: ${found.conversation.client_name || found.conversation.client_phone || 'Unknown'}`);
    console.log(`   Канал: ${found.conversation.channel || 'unknown'}`);
    
    console.log(`\n💬 Сообщение:`);
    console.log(`   Текст: "${found.message.text}"`);
    console.log(`   Время: ${found.message.datetime || found.message.sent_at}`);
    console.log(`   Направление: ${found.message.direction || 'unknown'}`);

    // Проверяем Telegram тему
    console.log(`\n🔍 Проверка Telegram темы...`);
    const telegramTopic = await checkTelegramTopic(found.conversation.id);

    if (telegramTopic && telegramTopic.tg_topic_id) {
      console.log(`\n✅ Тема создана в Telegram!`);
      console.log(`   Chat ID: ${telegramTopic.tg_chat_id}`);
      console.log(`   Topic ID: ${telegramTopic.tg_topic_id}`);
      console.log(`   Статус: ${telegramTopic.status}`);
      console.log(`   Сессия до: ${telegramTopic.session_expires_at || 'N/A'}`);
      console.log(`\n💡 Проверьте Telegram группу "Umnico + TG BOT" - должна быть тема с этим сообщением!`);
    } else {
      console.log(`\n⏳ Тема еще не создана в Telegram`);
      console.log(`   💡 UmnicoRealtimeSync обработает сообщение в течение 5 секунд`);
      console.log(`   💡 Проверьте логи Jarvis API на наличие:`);
      console.log(`      "Found X new messages in conversation ${found.conversation.id}"`);
      console.log(`      "Creating new topic for conversation ${found.conversation.id}"`);
    }

    process.exit(0);
  } else {
    if (attempts % 6 === 0) {
      console.log(`⏳ [${attempts}/${maxAttempts}] Сообщение "${SEARCH_TEXT}" еще не найдено...`);
    }
  }

  if (attempts >= maxAttempts) {
    clearInterval(interval);
    console.log(`\n⏱️  Время ожидания истекло (5 минут)`);
    console.log(`\n💡 Проверьте:`);
    console.log(`   1. Сообщение отправлено в Umnico`);
    console.log(`   2. Playwright Service подключен к Umnico`);
    console.log(`   3. Текст сообщения содержит "${SEARCH_TEXT}"`);
    console.log(`   4. Jarvis API запущен и UmnicoRealtimeSync работает`);
    process.exit(1);
  }
}, 5000); // Каждые 5 секунд

// Первая проверка сразу
setTimeout(async () => {
  const found = await findMessage();
  if (found) {
    clearInterval(interval);
    console.log('\n✅ Сообщение найдено сразу!');
    // Повторяем логику выше
  }
}, 1000);

