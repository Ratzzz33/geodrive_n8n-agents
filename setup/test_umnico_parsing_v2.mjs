#!/usr/bin/env node
/**
 * Тестирование новой логики парсинга Umnico V2
 * 
 * Проверяет:
 * 1. Логику x < y / x = y / incomplete
 * 2. Парсинг Telegram клиентов без телефона
 * 3. Расширенный формат API response
 * 
 * Использование:
 *   node setup/test_umnico_parsing_v2.mjs [conversation_id]
 *   node setup/test_umnico_parsing_v2.mjs 61965921
 */

import fetch from 'node-fetch';

const PLAYWRIGHT_URL = process.env.PLAYWRIGHT_UMNICO_URL || 'http://localhost:3001';

// Получить ID из аргументов или использовать тестовый
const args = process.argv.slice(2);
const conversationId = args[0] || '61965921';

async function testParsing() {
  console.log('🧪 Тестирование новой логики парсинга Umnico V2\n');
  console.log(`📋 Диалог ID: ${conversationId}\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // 1. Health check
    console.log('1️⃣ Проверка доступности сервиса...');
    const healthRes = await fetch(`${PLAYWRIGHT_URL}/health`);
    const health = await healthRes.json();
    
    if (!health.ok) {
      console.error('❌ Сервис недоступен!');
      process.exit(1);
    }
    
    console.log('   ✅ Сервис работает');
    console.log(`   🕐 Uptime: ${Math.round(health.uptime / 60)} минут`);
    console.log(`   🔐 Логин: ${health.lastLoginAt}\n`);

    // 2. Получить сообщения с новой логикой
    console.log('2️⃣ Получение сообщений (новая логика)...');
    const messagesRes = await fetch(`${PLAYWRIGHT_URL}/api/conversations/${conversationId}/messages`);
    const result = await messagesRes.json();
    
    if (!result.ok) {
      console.error('❌ Ошибка получения сообщений:', result.error);
      process.exit(1);
    }
    
    console.log('\n📊 РЕЗУЛЬТАТ:\n');
    
    // 3. Анализ результата
    console.log('   📈 Статистика:');
    console.log(`      Получено: ${result.count} сообщений`);
    console.log(`      Всего в UI: ${result.total || 'не определено'}`);
    console.log(`      Статус: ${result.incomplete ? '⚠️  INCOMPLETE' : '✅ COMPLETE'}`);
    
    // Логика x/y
    if (result.total) {
      const ratio = `${result.count}/${result.total}`;
      console.log(`      Соотношение: ${ratio}`);
      
      if (result.count < result.total) {
        console.log(`      ✅ x < y (${ratio}) → всё получили успешно!`);
      } else if (result.count === result.total) {
        if (result.incomplete) {
          console.log(`      ⚠️  x = y (${ratio}) → прокрутка не помогла, нужна ручная доработка`);
        } else {
          console.log(`      🔄 x = y (${ratio}) → прокрутка успешна или это все сообщения`);
        }
      } else {
        console.log(`      ⚠️  x > y (${ratio}) → странная ситуация!`);
      }
    } else {
      console.log(`      ⚠️  Не удалось определить total из UI`);
    }
    
    console.log('\n   📱 Информация о клиенте:');
    console.log(`      Телефон: ${result.clientPhone || 'нет'}`);
    console.log(`      Telegram: ${result.clientTelegram || 'нет'}`);
    console.log(`      Канал: ${result.channel}`);
    console.log(`      Аккаунт: ${result.channelAccount || 'нет'}`);
    
    // Определяем тип клиента
    if (result.clientPhone) {
      console.log(`      Тип: 💬 WhatsApp клиент`);
    } else if (result.clientTelegram) {
      console.log(`      Тип: ✈️  Telegram клиент (без телефона)`);
    } else {
      console.log(`      Тип: ❓ Неизвестно`);
    }
    
    console.log('\n   📝 Примеры сообщений:');
    const messages = result.data || [];
    const samples = messages.slice(0, 5);
    
    if (samples.length === 0) {
      console.log('      ⚠️  Нет сообщений');
    } else {
      samples.forEach((msg, idx) => {
        const direction = msg.direction === 'outgoing' ? '→' : '←';
        const text = (msg.text || '').slice(0, 50);
        console.log(`      ${idx + 1}. ${direction} ${msg.time}: ${text}${msg.text?.length > 50 ? '...' : ''}`);
      });
      
      if (messages.length > 5) {
        console.log(`      ... и ещё ${messages.length - 5} сообщений`);
      }
    }
    
    // 4. Рекомендации
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('💡 РЕКОМЕНДАЦИИ:\n');
    
    if (result.incomplete) {
      console.log('⚠️  Диалог помечен как INCOMPLETE!');
      console.log('   Варианты действий:');
      console.log('   1. Повторить попытку позже (возможно, сообщения подгрузятся)');
      console.log('   2. Использовать MCP Chrome для ручной прокрутки');
      console.log('   3. Сохранить как есть и пометить в БД для будущей обработки\n');
    } else {
      console.log('✅ Диалог успешно обработан!');
      console.log('   Можно сохранять в БД.\n');
    }
    
    if (!result.clientPhone && !result.clientTelegram) {
      console.log('⚠️  Не удалось определить идентификатор клиента!');
      console.log('   Проверьте селекторы в playwright-umnico-optimized.ts\n');
    } else if (result.clientTelegram && !result.clientPhone) {
      console.log('✈️  Telegram клиент без телефона');
      console.log('   Сохранить в БД с telegram_username\n');
    }
    
    // 5. Итоговый статус
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (!result.incomplete && (result.clientPhone || result.clientTelegram)) {
      console.log('✅ ТЕСТ ПРОЙДЕН: Диалог готов к сохранению в БД\n');
    } else {
      console.log('⚠️  ТРЕБУЕТСЯ ВНИМАНИЕ: Проверьте рекомендации выше\n');
    }
    
  } catch (error) {
    console.error('\n❌ ОШИБКА:', error.message);
    process.exit(1);
  }
}

testParsing();

