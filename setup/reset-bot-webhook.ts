/**
 * Скрипт для сброса webhook основного бота
 * Используется когда бот был случайно настроен на webhook (например, через n8n)
 */

import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';

dotenv.config();

const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken) {
  console.error('❌ TELEGRAM_BOT_TOKEN не установлен');
  process.exit(1);
}

async function resetWebhook() {
  const bot = new Telegraf(botToken);
  
  try {
    console.log('🔄 Удаляю webhook для основного бота...');
    
    const result = await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    
    if (result) {
      console.log('✅ Webhook успешно удален');
    }
    
    // Получаем информацию о боте
    const me = await bot.telegram.getMe();
    console.log(`📱 Бот: @${me.username} (ID: ${me.id})`);
    console.log(`📝 Имя: ${me.first_name}`);
    
    console.log('\n✅ Бот готов к работе в polling режиме');
    console.log('💡 Теперь запустите бота на сервере: npm run dev или npm start');
    
  } catch (error) {
    console.error('❌ Ошибка при удалении webhook:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

resetWebhook();

