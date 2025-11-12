#!/usr/bin/env node

/**
 * Парсинг диалогов Umnico через MCP Chrome
 * Для диалогов, где x=y (total неизвестен)
 * 
 * Использует MCP Chrome инструменты для навигации и парсинга
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

console.log(`\n🔍 Найдено ${dialogIds.length} диалогов для парсинга через MCP Chrome\n`);

if (dialogIds.length === 0) {
  console.log('❌ Список ID пуст');
  process.exit(1);
}

console.log('📋 Инструкция для использования MCP Chrome:\n');
console.log('Этот скрипт должен быть запущен в контексте, где доступны MCP Chrome инструменты.');
console.log('Используйте следующие команды для каждого диалога:\n');

console.log('='.repeat(80));
console.log('ШАГ 1: ЛОГИН В UMNICO (если еще не залогинены)');
console.log('='.repeat(80));
console.log(`1. mcp_chrome-devtools_navigate("https://umnico.com/login")`);
console.log(`2. mcp_chrome-devtools_wait_for("input[name='email']")`);
console.log(`3. mcp_chrome-devtools_type("input[name='email']", "${UMNICO_EMAIL}")`);
console.log(`4. mcp_chrome-devtools_type("input[type='password']", "${UMNICO_PASSWORD}")`);
console.log(`5. mcp_chrome-devtools_click("button[type='submit']")`);
console.log(`6. mcp_chrome-devtools_wait_for("селектор inbox", {timeout: 15000})`);

console.log('\n' + '='.repeat(80));
console.log('ШАГ 2: ПАРСИНГ КАЖДОГО ДИАЛОГА');
console.log('='.repeat(80));

dialogIds.forEach((id, index) => {
  console.log(`\n📦 Диалог ${index + 1}/${dialogIds.length}: ID ${id}`);
  console.log(`1. mcp_chrome-devtools_navigate("https://umnico.com/app/inbox/deals/inbox/details/${id}")`);
  console.log(`2. mcp_chrome-devtools_wait_for(".im-stack__messages")`);
  console.log(`3. mcp_chrome-devtools_evaluate(`
    + `"() => { const msgs = document.querySelectorAll('.im-stack__messages-item-wrap'); return msgs.length; }")`);
  console.log(`4. Проверка x/y и прокрутка при необходимости`);
  console.log(`5. mcp_chrome-devtools_evaluate("код для извлечения всех сообщений")`);
  console.log(`6. Сохранение в БД`);
});

console.log('\n' + '='.repeat(80));
console.log('КОД ДЛЯ ИЗВЛЕЧЕНИЯ СООБЩЕНИЙ:');
console.log('='.repeat(80));
console.log(`
const extractMessages = () => {
  const wraps = document.querySelectorAll('.im-stack__messages-item-wrap');
  return Array.from(wraps).map((wrap, index) => {
    const messageDiv = wrap.querySelector('.im-message');
    if (!messageDiv) return null;
    
    const textEl = messageDiv.querySelector('.im-message__text');
    const timeEl = messageDiv.querySelector('.im-info__date');
    const dateAttr = wrap.querySelector('.im-stack__messages-item')?.getAttribute('name');
    
    const isOutgoing = messageDiv.classList.contains('im-message_out') || 
                      messageDiv.classList.contains('im-message--outgoing');
    
    return {
      index,
      text: textEl?.textContent?.trim() || '',
      time: timeEl?.textContent?.trim() || '',
      datetime: dateAttr || '',
      direction: isOutgoing ? 'outgoing' : 'incoming',
      hasAttachments: messageDiv.querySelectorAll('img:not([alt])').length > 0
    };
  }).filter(m => m !== null);
};

// Получить общее количество (если доступно)
const getTotal = () => {
  const selectors = ['.im-header__count', '.messages-count', '[class*="count"]'];
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      const text = el.textContent?.trim() || '';
      const match = text.match(/(\\d+)/);
      if (match) return parseInt(match[1]);
    }
  }
  return null;
};

// Прокрутка вверх для загрузки больше сообщений
const scrollUp = () => {
  const container = document.querySelector('.im-stack__messages');
  if (container) {
    const oldScrollTop = container.scrollTop;
    container.scrollTop = 0;
    return container.scrollTop !== oldScrollTop;
  }
  return false;
};

return {
  messages: extractMessages(),
  total: getTotal(),
  canScroll: scrollUp()
};
`);

console.log('\n' + '='.repeat(80));
console.log('СПИСОК ID ДЛЯ ОБРАБОТКИ:');
console.log('='.repeat(80));
console.log(dialogIds.join(', '));
console.log('='.repeat(80) + '\n');

await sql.end();

