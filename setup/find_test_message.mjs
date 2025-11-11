/**
 * Поиск тестового сообщения в Umnico
 * Используется для проверки что интеграция работает
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const PLAYWRIGHT_URL = process.env.PLAYWRIGHT_UMNICO_URL || 'http://localhost:3001';
const SEARCH_TEXT = process.argv[2] || 'TEST';

console.log(`🔍 Поиск тестового сообщения "${SEARCH_TEXT}" в Umnico...\n`);

async function findTestMessage() {
  try {
    // Получаем список диалогов
    console.log('1️⃣ Получение списка диалогов...');
    const conversationsResponse = await fetch(`${PLAYWRIGHT_URL}/api/conversations`);
    
    if (!conversationsResponse.ok) {
      throw new Error(`HTTP ${conversationsResponse.status}`);
    }

    const conversationsData: any = await conversationsResponse.json();
    
    if (!conversationsData.ok) {
      throw new Error(conversationsData.error || 'Unknown error');
    }

    const conversations = conversationsData.data || [];
    console.log(`   ✅ Найдено диалогов: ${conversations.length}\n`);

    // Ищем диалог с тестовым сообщением
    console.log(`2️⃣ Поиск сообщения "${SEARCH_TEXT}"...`);
    
    for (const conv of conversations) {
      try {
        const messagesResponse = await fetch(
          `${PLAYWRIGHT_URL}/api/conversations/${conv.id}/messages`
        );

        if (!messagesResponse.ok) continue;

        const messagesData: any = await messagesResponse.json();
        const messages = messagesData.data || [];

        // Ищем сообщение с текстом
        const foundMessage = messages.find((msg: any) => 
          msg.text && msg.text.toUpperCase().includes(SEARCH_TEXT.toUpperCase())
        );

        if (foundMessage) {
          console.log(`\n✅ Сообщение найдено!`);
          console.log(`   Диалог ID: ${conv.id}`);
          console.log(`   Клиент: ${conv.client_name || conv.client_phone || 'Unknown'}`);
          console.log(`   Сообщение: "${foundMessage.text}"`);
          console.log(`   Время: ${foundMessage.datetime || foundMessage.sent_at}`);
          console.log(`   Направление: ${foundMessage.direction || 'unknown'}`);
          
          // Проверяем есть ли тема в Telegram
          const postgres = (await import('postgres')).default;
          const CONNECTION_STRING = process.env.DATABASE_URL || 
            'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
          
          const sql = postgres(CONNECTION_STRING, {
            max: 1,
            ssl: { rejectUnauthorized: false }
          });

          const conversation = await sql`
            SELECT tg_chat_id, tg_topic_id, client_name, status
            FROM conversations
            WHERE umnico_conversation_id = ${conv.id}
            LIMIT 1
          `;

          if (conversation.length > 0 && conversation[0].tg_topic_id) {
            console.log(`\n   ✅ Тема создана в Telegram!`);
            console.log(`   Chat ID: ${conversation[0].tg_chat_id}`);
            console.log(`   Topic ID: ${conversation[0].tg_topic_id}`);
            console.log(`   Статус: ${conversation[0].status}`);
          } else {
            console.log(`\n   ⚠️  Тема еще не создана в Telegram`);
            console.log(`   💡 Подождите несколько секунд, UmnicoRealtimeSync обработает сообщение`);
          }

          await sql.end();
          return;
        }
      } catch (error) {
        // Продолжаем поиск
        continue;
      }
    }

    console.log(`\n⚠️  Сообщение "${SEARCH_TEXT}" не найдено`);
    console.log(`   💡 Убедитесь что:`);
    console.log(`      - Сообщение отправлено в Umnico`);
    console.log(`      - Playwright Service подключен к Umnico`);
    console.log(`      - Текст сообщения содержит "${SEARCH_TEXT}"`);

  } catch (error) {
    console.error(`\n❌ Ошибка поиска: ${error.message}`);
    console.error(`   💡 Проверьте что Playwright Service запущен и доступен`);
  }
}

findTestMessage();

