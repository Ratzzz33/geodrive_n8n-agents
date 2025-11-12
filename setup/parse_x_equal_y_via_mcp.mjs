#!/usr/bin/env node

/**
 * Парсинг диалогов Umnico через MCP Chrome
 * Для диалогов, где x=y (total неизвестен)
 */

import { readFileSync } from 'fs';
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = postgres(CONNECTION_STRING, { max: 1, ssl: { rejectUnauthorized: false } });

const UMNICO_EMAIL = 'geodrive.ge@gmail.com';
const UMNICO_PASSWORD = '2GeoDriveumnicopassword!!))';

// Читаем список ID из файла
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

console.log('📋 Инструкция для парсинга через MCP Chrome:\n');
console.log('1. Используйте MCP Chrome для навигации к каждому диалогу');
console.log('2. URL диалога: https://umnico.com/app/inbox/deals/inbox?conversationId={ID}');
console.log('3. Примените логику x/y для проверки и прокрутки');
console.log('4. Сохраните результаты в БД\n');

console.log('='.repeat(80));
console.log('СПИСОК ID ДЛЯ ПАРСИНГА:');
console.log('='.repeat(80));
console.log(dialogIds.join(', '));
console.log('='.repeat(80));

console.log('\n📝 Пример команд MCP Chrome для первого диалога:');
console.log(`\n1. Навигация: mcp_chrome-devtools_navigate("https://umnico.com/app/inbox/deals/inbox?conversationId=${dialogIds[0]}")`);
console.log('2. Ожидание загрузки: mcp_chrome-devtools_wait_for("селектор сообщений")');
console.log('3. Получение сообщений: mcp_chrome-devtools_evaluate("код для извлечения сообщений")');
console.log('4. Проверка x/y и прокрутка при необходимости');

console.log('\n💡 Рекомендация:');
console.log('   Создайте n8n workflow или скрипт, который будет использовать');
console.log('   существующий Playwright сервис с улучшенной логикой для x=y случаев');

await sql.end();

