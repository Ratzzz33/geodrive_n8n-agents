#!/usr/bin/env node

/**
 * Сбор ID всех чатов из Umnico через MCP Chrome DevTools
 * 
 * План:
 * 1. Открываем Umnico inbox в браузере
 * 2. Прокручиваем список чатов с подгрузкой
 * 3. Собираем все ID чатов из DOM
 * 4. Сохраняем в БД
 */

import { config } from 'dotenv';
import postgres from 'postgres';

config();

const sql = postgres(process.env.NEON_CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

// URL Umnico inbox
const UMNICO_INBOX_URL = 'https://umnico.com/app/inbox/deals/inbox';

console.log('🔍 Запуск сбора ID чатов из Umnico...\n');

async function collectChatIds() {
  try {
    console.log('📝 Инструкции для MCP Chrome DevTools:\n');
    console.log('1. Откройте Cursor');
    console.log('2. Используйте AI-агента с командами:\n');
    
    console.log('// Шаг 1: Открыть Umnico inbox');
    console.log(`mcp_chrome-devtools_navigate({ url: "${UMNICO_INBOX_URL}" })\n`);
    
    console.log('// Шаг 2: Дождаться загрузки (если нужна авторизация - войти вручную)');
    console.log('mcp_chrome-devtools_wait_for({ selector: "[data-test-id=\\"conversation-list\\"]", timeout: 30000 })\n');
    
    console.log('// Шаг 3: Прокрутить список чатов для подгрузки всех');
    console.log(`mcp_chrome-devtools_evaluate({
  expression: \`
    (async () => {
      const container = document.querySelector('[data-test-id="conversation-list"]') || 
                       document.querySelector('.conversations-list') ||
                       document.querySelector('.inbox-list');
      
      if (!container) return { error: 'Container not found' };
      
      let previousHeight = 0;
      let scrollAttempts = 0;
      const maxScrolls = 50; // Максимум прокруток
      
      while (scrollAttempts < maxScrolls) {
        container.scrollTop = container.scrollHeight;
        await new Promise(resolve => setTimeout(resolve, 1000)); // Ждем подгрузки
        
        const currentHeight = container.scrollHeight;
        if (currentHeight === previousHeight) {
          console.log('Достигнут конец списка');
          break;
        }
        
        previousHeight = currentHeight;
        scrollAttempts++;
        console.log(\`Прокрутка \${scrollAttempts}/\${maxScrolls}\`);
      }
      
      return { scrolled: scrollAttempts, finalHeight: previousHeight };
    })()
  \`
})\n`);
    
    console.log('// Шаг 4: Собрать все ID чатов');
    console.log(`mcp_chrome-devtools_evaluate({
  expression: \`
    (() => {
      // Ищем все элементы чатов
      const chatElements = document.querySelectorAll(
        '[data-conversation-id], [data-chat-id], .conversation-item, .chat-item'
      );
      
      const chatIds = [];
      
      chatElements.forEach(el => {
        // Пробуем разные атрибуты
        const id = el.getAttribute('data-conversation-id') ||
                   el.getAttribute('data-chat-id') ||
                   el.getAttribute('data-id') ||
                   el.id;
        
        // Или извлекаем из href
        const link = el.querySelector('a[href*="/details/"]');
        if (link) {
          const match = link.href.match(/\\/details\\/(\\d+)/);
          if (match) {
            chatIds.push({
              id: match[1],
              source: 'href'
            });
          }
        } else if (id) {
          chatIds.push({
            id: id,
            source: 'attribute'
          });
        }
      });
      
      // Дедупликация
      const uniqueIds = [...new Set(chatIds.map(c => c.id))];
      
      return {
        total: uniqueIds.length,
        ids: uniqueIds,
        sample: uniqueIds.slice(0, 10) // Первые 10 для проверки
      };
    })()
  \`
})\n`);

    console.log('// Шаг 5: Скопировать результат и сохранить в файл');
    console.log('// Затем запустить: node setup/save_umnico_chat_ids.mjs chat_ids.json\n');

    console.log('\n📋 Альтернатива: можно также использовать DevTools Console напрямую:');
    console.log('1. Откройте https://umnico.com/app/inbox/deals/inbox');
    console.log('2. Откройте DevTools (F12)');
    console.log('3. Вставьте скрипт из Шага 3 в консоль');
    console.log('4. Затем скрипт из Шага 4');
    console.log('5. Скопируйте результат и сохраните в chat_ids.json\n');

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Создаем таблицу для хранения ID чатов
async function createTableIfNeeded() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS umnico_chat_ids (
        id TEXT PRIMARY KEY,
        discovered_at TIMESTAMPTZ DEFAULT NOW(),
        source TEXT,
        processed BOOLEAN DEFAULT FALSE,
        last_sync_at TIMESTAMPTZ,
        metadata JSONB
      )
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_umnico_chat_ids_processed 
      ON umnico_chat_ids(processed) 
      WHERE processed = FALSE
    `;
    
    console.log('✅ Таблица umnico_chat_ids готова\n');
  } catch (error) {
    console.error('❌ Ошибка создания таблицы:', error);
    throw error;
  }
}

// Запуск
createTableIfNeeded()
  .then(() => collectChatIds())
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });

