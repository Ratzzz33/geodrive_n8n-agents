#!/usr/bin/env node

/**
 * Тест загрузки конкретного чата для проверки прокрутки
 */

const PLAYWRIGHT_SERVICE_URL = process.env.PLAYWRIGHT_UMNICO_URL || 'http://localhost:3001';
const TEST_CHAT_ID = process.argv[2] || '60346281'; // ID чата с 0 сообщений

console.log(`🔍 Тестирование загрузки чата ${TEST_CHAT_ID}...\n`);

async function testChat() {
  try {
    console.log('1. Запрос с all=true (должен прокрутить до конца)...');
    const response = await fetch(
      `${PLAYWRIGHT_SERVICE_URL}/api/conversations/${TEST_CHAT_ID}/messages?all=true`
    );
    
    if (!response.ok) {
      console.error(`❌ HTTP ${response.status}: ${response.statusText}`);
      const text = await response.text();
      console.error(`Ответ: ${text}`);
      return;
    }
    
    const data = await response.json();
    
    if (!data.ok) {
      console.error(`❌ Ошибка: ${data.error}`);
      return;
    }
    
    const messages = data.data || data.messages || [];
    console.log(`✅ Получено сообщений: ${messages.length}\n`);
    
    if (messages.length === 0) {
      console.log('⚠️  Чат действительно пустой (0 сообщений)');
      console.log('   Это может быть:');
      console.log('   - Пустой чат (только системные сообщения)');
      console.log('   - Удаленный чат');
      console.log('   - Чат без истории сообщений\n');
    } else {
      console.log('📝 Примеры сообщений:\n');
      messages.slice(0, 5).forEach((msg, i) => {
        const textPreview = msg.text ? (msg.text.length > 50 ? msg.text.substring(0, 50) + '...' : msg.text) : '(без текста)';
        console.log(`${i + 1}. [${msg.direction}] ${msg.datetime || 'N/A'}`);
        console.log(`   "${textPreview}"\n`);
      });
      
      if (messages.length > 5) {
        console.log(`... и еще ${messages.length - 5} сообщений\n`);
      }
      
      // Проверяем есть ли сообщения с текстом
      const withText = messages.filter(m => m.text && m.text.trim().length > 0).length;
      console.log(`📊 Статистика:`);
      console.log(`   Всего: ${messages.length}`);
      console.log(`   С текстом: ${withText}`);
      console.log(`   Без текста: ${messages.length - withText}\n`);
    }
    
    // Проверяем что Playwright действительно прокрутил
    console.log('2. Проверка что Playwright прокрутил до конца...');
    console.log(`   В ответе указано: count=${data.count || 'N/A'}`);
    console.log(`   Реально получено: ${messages.length}`);
    
    if (data.count && data.count > messages.length) {
      console.warn(`   ⚠️  Возможно не все сообщения загружены!`);
    } else {
      console.log(`   ✅ Все сообщения загружены\n`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

testChat();

