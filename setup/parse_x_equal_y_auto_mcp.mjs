#!/usr/bin/env node

/**
 * Автоматический парсинг диалогов Umnico через MCP Chrome
 * Для диалогов, где x=y (total неизвестен)
 * 
 * ВАЖНО: Этот скрипт должен быть запущен в контексте с доступом к MCP Chrome инструментам
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

// Этот скрипт будет использовать MCP Chrome инструменты
// Но так как MCP инструменты доступны только в контексте агента,
// нужно создать инструкции для ручного выполнения или использовать другой подход

console.log('⚠️  ВНИМАНИЕ:');
console.log('   MCP Chrome инструменты доступны только в контексте Cursor Agent.');
console.log('   Для автоматического парсинга нужно:');
console.log('   1. Использовать этот скрипт в интерактивном режиме с агентом');
console.log('   2. Или создать n8n workflow с MCP Chrome нодами');
console.log('   3. Или использовать существующий Playwright сервис с улучшенной логикой\n');

console.log('📋 Список ID для обработки:');
console.log(dialogIds.join(', '));
console.log(`\nВсего: ${dialogIds.length} диалогов\n`);

await sql.end();

