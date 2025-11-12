#!/usr/bin/env node

/**
 * Автоматический парсинг всех диалогов x=y через MCP Chrome
 * 
 * ВАЖНО: Этот скрипт должен выполняться агентом с доступом к MCP Chrome инструментам
 * Агент будет вызывать MCP Chrome инструменты для каждого диалога
 */

import { readFileSync } from 'fs';
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = postgres(CONNECTION_STRING, { max: 1, ssl: { rejectUnauthorized: false } });

// Читаем список ID
const idsContent = readFileSync('dialog_ids_list.txt', 'utf8');
const idsMatch = idsContent.match(/📋 Список ID:\s*\n([\d,\s]+)/);
const dialogIds = idsMatch 
  ? idsMatch[1].split(',').map(id => id.trim()).filter(Boolean)
  : [];

console.log(`\n🚀 Автоматический парсинг ${dialogIds.length} диалогов через MCP Chrome\n`);
console.log(`📋 ID: ${dialogIds.join(', ')}\n`);

// Код для извлечения сообщений (будет использоваться в mcp_chrome-devtools_evaluate)
const EXTRACT_MESSAGES_CODE = `
(() => {
  const wraps = document.querySelectorAll('.im-stack__messages-item-wrap');
  const messages = Array.from(wraps).map((wrap) => {
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
    loaded: messages.length,
    clientPhone: phone,
    clientTelegram: telegram,
    channel: channel,
    channelAccount: channelAccount
  };
})()
`;

// Код для прокрутки вверх
const SCROLL_UP_CODE = `
(() => {
  const container = document.querySelector('.im-stack__messages');
  if (container) {
    const beforeScroll = container.scrollTop;
    container.scrollTop = 0;
    return { scrolled: container.scrollTop !== beforeScroll, scrollTop: container.scrollTop };
  }
  return { scrolled: false };
})()
`;

console.log('📝 Инструкции для агента:\n');
console.log('Для каждого диалога выполните следующие шаги:\n');

dialogIds.forEach((id, index) => {
  console.log(`\n${index + 1}. Диалог ${id}:`);
  console.log(`   1. mcp_chrome-devtools_navigate("https://umnico.com/app/inbox/deals/inbox/details/${id}")`);
  console.log(`   2. mcp_chrome-devtools_wait_for(".im-stack__messages-item-wrap", {timeout: 10000})`);
  console.log(`   3. mcp_chrome-devtools_evaluate("${EXTRACT_MESSAGES_CODE.replace(/\n/g, ' ').replace(/\s+/g, ' ')}")`);
  console.log(`   4. Если loaded много, попробовать прокрутку: mcp_chrome-devtools_evaluate("${SCROLL_UP_CODE.replace(/\n/g, ' ').replace(/\s+/g, ' ')}")`);
  console.log(`   5. Повторить шаг 3 после прокрутки`);
  console.log(`   6. Сохранить данные в БД`);
});

console.log(`\n✅ Всего ${dialogIds.length} диалогов для обработки\n`);

await sql.end();

