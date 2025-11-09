#!/usr/bin/env node
/**
 * Импорт AI Agent системы для курсов валют
 * 
 * Состоит из 3 workflows:
 * 1. Query Exchange Rates Tool - инструмент для AI Agent (SQL запросы)
 * 2. Exchange Rates AI Assistant - AI Agent с Chat Trigger
 * 3. Telegram Exchange Rates Bot - Telegram бот, вызывающий AI Agent
 */

import { readFileSync } from 'fs';

console.log('📦 Импорт AI Agent системы для курсов валют\n');

// Читаем файлы
const workflows = [
  {
    name: 'Query Exchange Rates Tool',
    file: 'n8n-workflows/query-exchange-rates-tool.json',
    description: 'Инструмент SQL для AI Agent'
  },
  {
    name: 'Exchange Rates AI Assistant',
    file: 'n8n-workflows/exchange-rates-ai-agent.json',
    description: 'AI Agent с Chat Trigger'
  },
  {
    name: 'Telegram Exchange Rates Bot',
    file: 'n8n-workflows/telegram-exchange-rates-bot.json',
    description: 'Telegram бот'
  }
];

console.log('Файлы подготовлены:\n');
workflows.forEach((wf, i) => {
  console.log(`${i + 1}. ${wf.name}`);
  console.log(`   Файл: ${wf.file}`);
  console.log(`   Описание: ${wf.description}\n`);
});

console.log('─'.repeat(60));
console.log('\n📋 Следующие шаги для импорта:\n');

console.log('1. Откройте n8n UI: https://n8n.rentflow.rentals\n');

console.log('2. Создайте Credentials (если еще нет):\n');
console.log('   ✅ PostgreSQL Neon (ID: postgres-neon)');
console.log('      - Host: ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech');
console.log('      - Database: neondb');
console.log('      - User: neondb_owner\n');

console.log('   ✅ OpenAI (ID: openai-main)');
console.log('      - API Key: ваш ключ OpenAI\n');

console.log('   ✅ Telegram Main Bot (ID: telegram-main-bot)');
console.log('      - Token: токен основного бота @test_geodrive_check_bot\n');

console.log('3. Импортируйте workflows в порядке:\n');
workflows.forEach((wf, i) => {
  console.log(`   ${i + 1}. ${wf.file}`);
});

console.log('\n4. После импорта "Query Exchange Rates Tool":\n');
console.log('   - Откройте "Exchange Rates AI Assistant"');
console.log('   - Найдите ноду "Tool: Query Exchange Rates"');
console.log('   - В параметре "Workflow ID" выберите "Query Exchange Rates Tool"\n');

console.log('5. Настройте вебхук для Telegram бота:\n');
console.log('   - Откройте "Telegram Exchange Rates Bot"');
console.log('   - Скопируйте Production URL вебхука');
console.log('   - Установите через BotFather или API\n');

console.log('6. Активируйте workflows:\n');
console.log('   ✅ Query Exchange Rates Tool (можно оставить неактивным)');
console.log('   ✅ Exchange Rates AI Assistant');
console.log('   ✅ Telegram Exchange Rates Bot\n');

console.log('─'.repeat(60));
console.log('\n🧪 Тестирование:\n');
console.log('1. Откройте Telegram бот');
console.log('2. Отправьте: /start');
console.log('3. Спросите: "Какой курс доллара?"');
console.log('4. AI Agent должен вызвать Query Exchange Rates Tool');
console.log('5. Вы получите ответ с текущими курсами\n');

console.log('─'.repeat(60));
console.log('\n💡 Подсказки:\n');
console.log('- AI Agent использует gpt-4o-mini (можно поменять на gpt-4)');
console.log('- System message можно настроить в AI Agent ноде');
console.log('- Инструмент автоматически определяет филиал и дату');
console.log('- Поддерживает вопросы на русском языке\n');

console.log('✅ Импорт готов!\n');

