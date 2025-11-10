/**
 * Скрипт для проверки типа Telegram чата (группа/форум)
 * 
 * Использование:
 *   node setup/check_telegram_chat_type.mjs
 * 
 * Требует:
 *   - N8N_ALERTS_TELEGRAM_BOT_TOKEN в переменных окружения
 *   - UMNICO_FORUM_CHAT_ID в переменных окружения
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем .env
dotenv.config({ path: join(__dirname, '..', '.env') });

const BOT_TOKEN = process.env.N8N_ALERTS_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.UMNICO_FORUM_CHAT_ID;

if (!BOT_TOKEN) {
  console.error('❌ N8N_ALERTS_TELEGRAM_BOT_TOKEN или TELEGRAM_BOT_TOKEN не установлен');
  process.exit(1);
}

if (!CHAT_ID) {
  console.error('❌ UMNICO_FORUM_CHAT_ID не установлен');
  process.exit(1);
}

async function checkChatType() {
  console.log('🔍 Проверка типа Telegram чата...\n');
  console.log(`Chat ID: ${CHAT_ID}`);
  console.log(`Bot Token: ${BOT_TOKEN.substring(0, 10)}...\n`);

  try {
    // Получаем информацию о чате
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getChat?chat_id=${CHAT_ID}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Telegram API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Telegram API returned error: ${JSON.stringify(data)}`);
    }

    const chat = data.result;

    console.log('📋 Информация о чате:');
    console.log(`   Название: ${chat.title || 'N/A'}`);
    console.log(`   Тип: ${chat.type}`);
    console.log(`   ID: ${chat.id}`);

    // Проверяем является ли чат форумом
    if (chat.type === 'supergroup' && chat.is_forum === true) {
      console.log('\n✅ Чат является форумом (supergroup с is_forum=true)');
      console.log('   Можно создавать темы через createForumTopic API');
      return true;
    } else if (chat.type === 'supergroup' && chat.is_forum === false) {
      console.log('\n⚠️  Чат является супергруппой, но НЕ форумом');
      console.log('   Нужно конвертировать в форум для создания тем');
      console.log('\n📝 Инструкция по конвертации:');
      console.log('   1. Откройте Telegram');
      console.log('   2. Зайдите в настройки группы');
      console.log('   3. Выберите "Тип группы" → "Форум"');
      console.log('   4. Подтвердите конвертацию');
      return false;
    } else if (chat.type === 'group') {
      console.log('\n⚠️  Чат является обычной группой');
      console.log('   Нужно сначала сделать супергруппой, затем форумом');
      console.log('\n📝 Инструкция:');
      console.log('   1. Откройте Telegram');
      console.log('   2. Зайдите в настройки группы');
      console.log('   3. Выберите "Преобразовать в супергруппу"');
      console.log('   4. Затем "Тип группы" → "Форум"');
      return false;
    } else {
      console.log(`\n❌ Неподдерживаемый тип чата: ${chat.type}`);
      console.log('   Для создания тем нужен форум (supergroup с is_forum=true)');
      return false;
    }
  } catch (error) {
    console.error('\n❌ Ошибка при проверке чата:');
    console.error(error.message);
    
    if (error.message.includes('chat not found')) {
      console.error('\n💡 Возможные причины:');
      console.error('   - Бот не добавлен в группу');
      console.error('   - Неверный Chat ID');
      console.error('   - Бот не имеет прав администратора');
    }
    
    process.exit(1);
  }
}

// Запуск
checkChatType()
  .then((isForum) => {
    if (isForum) {
      console.log('\n✅ Готово к использованию!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Требуется конвертация в форум перед использованием');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ Критическая ошибка:', error);
    process.exit(1);
  });

