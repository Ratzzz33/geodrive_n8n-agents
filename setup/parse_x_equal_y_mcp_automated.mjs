#!/usr/bin/env node

/**
 * Автоматический парсинг диалогов x=y через MCP Chrome
 * 
 * ВАЖНО: Этот скрипт должен выполняться агентом с доступом к MCP Chrome
 */

import { readFileSync } from 'fs';
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = postgres(CONNECTION_STRING, { max: 1, ssl: { rejectUnauthorized: false } });

const UMNICO_EMAIL = 'geodrive.ge@gmail.com';
const UMNICO_PASSWORD = '2GeoDriveumnicopassword!!))';

// Читаем список ID
const idsContent = readFileSync('dialog_ids_list.txt', 'utf8');
const idsMatch = idsContent.match(/📋 Список ID:\s*\n([\d,\s]+)/);
const dialogIds = idsMatch 
  ? idsMatch[1].split(',').map(id => id.trim()).filter(Boolean)
  : [];

console.log(`\n🚀 Автоматический парсинг ${dialogIds.length} диалогов через MCP Chrome\n`);

// Функция для парсинга одного диалога (будет вызываться агентом через MCP Chrome)
async function parseDialog(conversationId) {
  console.log(`\n🔍 Парсинг диалога ${conversationId}...`);
  
  // ШАГ 1: Навигация к диалогу
  // mcp_chrome-devtools_navigate(`https://umnico.com/app/inbox/deals/inbox/details/${conversationId}`)
  
  // ШАГ 2: Ожидание загрузки
  // mcp_chrome-devtools_wait_for('.im-stack__messages-item-wrap')
  
  // ШАГ 3: Извлечение сообщений с проверкой x/y
  const extractCode = `
    (() => {
      const wraps = document.querySelectorAll('.im-stack__messages-item-wrap');
      let messages = Array.from(wraps).map((wrap, index) => {
        const messageDiv = wrap.querySelector('.im-message');
        if (!messageDiv) return null;
        
        const textEl = messageDiv.querySelector('.im-message__text');
        const timeEl = messageDiv.querySelector('.im-info__date');
        const dateAttr = wrap.querySelector('.im-stack__messages-item')?.getAttribute('name');
        
        const isOutgoing = messageDiv.classList.contains('im-message_out') || 
                          messageDiv.classList.contains('im-message--outgoing');
        
        return {
          text: textEl?.textContent?.trim() || '',
          time: timeEl?.textContent?.trim() || '',
          datetime: dateAttr || '',
          direction: isOutgoing ? 'outgoing' : 'incoming',
          hasAttachments: messageDiv.querySelectorAll('img:not([alt])').length > 0
        };
      }).filter(m => m !== null);
      
      // Определяем total
      const getTotal = () => {
        const selectors = ['.im-header__count', '.messages-count', '[class*="count"]'];
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el) {
            const text = el.textContent?.trim() || '';
            const match = text.match(/(\\d+)/);
            if (match) {
              const num = parseInt(match[1]);
              // Проверяем, что это не телефон (не слишком большое число)
              if (num < 100000) return num;
            }
          }
        }
        return null;
      };
      
      const total = getTotal();
      const loaded = messages.length;
      
      // Информация о клиенте
      const phoneLink = document.querySelector('a[href*="tel:"]');
      const phone = phoneLink ? phoneLink.textContent?.trim() : null;
      
      const sourceEl = document.querySelector('.im-source-item');
      const sourceText = sourceEl?.textContent?.trim() || '';
      let channel = 'unknown';
      let channelAccount = '';
      if (sourceText.includes('WhatsApp')) {
        channel = 'whatsapp';
        const accountMatch = sourceText.match(/(\\d+)/);
        channelAccount = accountMatch ? accountMatch[1] : '';
      } else if (sourceText.includes('Telegram')) {
        channel = 'telegram';
      }
      
      let telegram = null;
      if (!phone) {
        const headerEl = document.querySelector('.im-header__name, .client-name');
        const headerText = headerEl?.textContent?.trim() || '';
        const tgMatch = headerText.match(/@(\\w+)/);
        if (tgMatch) {
          telegram = tgMatch[1];
        } else if (headerText && !headerText.includes('+')) {
          telegram = headerText;
        }
      }
      
      return {
        messages: messages,
        loaded: loaded,
        total: total,
        clientPhone: phone,
        clientTelegram: telegram,
        channel: channel,
        channelAccount: channelAccount,
        needsScroll: total && loaded === total && total > 0
      };
    })()
  `;
  
  // ШАГ 4: Прокрутка если x=y
  const scrollCode = `
    (() => {
      const container = document.querySelector('.im-stack__messages');
      if (container) {
        const beforeScroll = container.scrollTop;
        container.scrollTop = 0;
        return container.scrollTop !== beforeScroll;
      }
      return false;
    })()
  `;
  
  return { extractCode, scrollCode };
}

// Генерируем инструкции для каждого диалога
console.log('📋 Инструкции для парсинга:\n');

dialogIds.forEach((id, index) => {
  const { extractCode, scrollCode } = parseDialog(id);
  console.log(`\n${index + 1}. Диалог ${id}:`);
  console.log(`   - Навигация: mcp_chrome-devtools_navigate("https://umnico.com/app/inbox/deals/inbox/details/${id}")`);
  console.log(`   - Ожидание: mcp_chrome-devtools_wait_for(".im-stack__messages-item-wrap")`);
  console.log(`   - Извлечение: mcp_chrome-devtools_evaluate(${JSON.stringify(extractCode)})`);
  console.log(`   - Прокрутка (если нужно): mcp_chrome-devtools_evaluate(${JSON.stringify(scrollCode)})`);
});

console.log(`\n✅ Сгенерировано ${dialogIds.length} инструкций для парсинга\n`);

await sql.end();

